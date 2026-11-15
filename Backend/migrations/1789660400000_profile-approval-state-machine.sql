-- Up Migration

-- Profile approval state machine (story 5).
-- "profileReviewStatus" holds draft / submitted / approved / needsChanges /
-- rejected. "accountStatus" keeps active / blocked (and pending / rejected as
-- before). The application's transitionProfileStatus() decides both values;
-- sp_set_profile_review_status is the only SQL that writes them after
-- registration, and the decision procedures below no longer touch
-- "accountStatus" themselves.

ALTER TABLE "Users"
    ADD COLUMN IF NOT EXISTS "profileReviewStatus" VARCHAR(20) NOT NULL DEFAULT 'draft',
    ADD COLUMN IF NOT EXISTS "profileSubmittedAt" TIMESTAMPTZ;

ALTER TABLE "Users"
    ADD CONSTRAINT "users_profile_review_status_check" CHECK (
        "profileReviewStatus" IN
            ('draft', 'submitted', 'approved', 'needsChanges', 'rejected')
    );

CREATE INDEX IF NOT EXISTS "idx_users_profileReviewStatus" ON "Users"("profileReviewStatus");

-- Existing members: derive the review status from what is already stored.
UPDATE "Users" u
SET "profileReviewStatus" = CASE
        WHEN u."accountStatus" = 'active' THEN 'approved'
        WHEN u."accountStatus" = 'rejected' THEN 'rejected'
        WHEN EXISTS (
            SELECT 1 FROM "KycVerifications" k
            WHERE k."userId" = u."id" AND k."status" = 'needsReview'
        ) THEN 'submitted'
        WHEN EXISTS (
            SELECT 1 FROM "KycVerifications" k
            WHERE k."userId" = u."id" AND k."status" = 'changesNeeded'
        ) THEN 'needsChanges'
        ELSE 'draft'
    END
WHERE u."role" = 'user';

UPDATE "Users" u
SET "profileSubmittedAt" = (
    SELECT MAX(m."attachedAt")
    FROM "KycMedia" m
    JOIN "KycVerifications" k ON k."id" = m."verificationId"
    WHERE k."userId" = u."id" AND m."attachedAt" IS NOT NULL
)
WHERE u."role" = 'user' AND u."profileReviewStatus" <> 'draft';

-- The single writer. Values come from transitionProfileStatus(); the
-- submission time is only kept while submitted and cleared on draft. A
-- non-null p_kyc_status moves the KYC case to the status chosen by the KYC
-- domain (a resubmission puts a changesNeeded case back into review).
CREATE OR REPLACE PROCEDURE sp_set_profile_review_status(
    p_user_id UUID,
    p_status TEXT,
    p_account_status TEXT,
    p_submitted_at TIMESTAMPTZ,
    p_kyc_status TEXT
)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE "Users"
    SET "profileReviewStatus" = p_status,
        "accountStatus" = p_account_status::"AccountStatus",
        "profileSubmittedAt" = CASE
            WHEN p_status = 'submitted' THEN p_submitted_at
            WHEN p_status = 'draft' THEN NULL
            ELSE "profileSubmittedAt"
        END,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = p_user_id;

    IF p_kyc_status IS NOT NULL THEN
        UPDATE "KycVerifications"
        SET "status" = p_kyc_status, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "userId" = p_user_id;
    END IF;
END;
$$;

-- Decision procedures: the status columns are now written by
-- sp_set_profile_review_status, called by the repository in the same
-- transaction with the values the domain chose.
CREATE OR REPLACE PROCEDURE sp_admin_approve_profile(
    p_target_user_id UUID,
    p_admin_id UUID,
    p_reason_code TEXT,
    p_notes TEXT,
    p_request_id TEXT,
    p_ip TEXT,
    p_user_agent TEXT
)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE "Users"
    SET "rejectionReason" = NULL,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = p_target_user_id;

    UPDATE "Profiles"
    SET "photoVerified" = true, "idVerified" = true, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "userId" = p_target_user_id;

    CALL sp_admin_record_review(
        p_target_user_id, p_admin_id, 'APPROVE_PROFILE', 'approved', 'approved',
        p_reason_code, p_notes, NULL, p_request_id, p_ip, p_user_agent
    );
END;
$$;

CREATE OR REPLACE PROCEDURE sp_admin_reject_profile(
    p_target_user_id UUID,
    p_admin_id UUID,
    p_reason_code TEXT,
    p_notes TEXT,
    p_request_id TEXT,
    p_ip TEXT,
    p_user_agent TEXT
)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE "Users"
    SET "rejectionReason" = COALESCE(p_notes, p_reason_code),
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = p_target_user_id;

    CALL sp_admin_record_review(
        p_target_user_id, p_admin_id, 'REJECT_PROFILE', 'rejected', 'failed',
        p_reason_code, p_notes, NULL, p_request_id, p_ip, p_user_agent
    );
END;
$$;

-- Moves a rejected profile back to editable. The status change itself is made
-- by sp_set_profile_review_status; this records the reason the member sees and
-- the one audit row.
CREATE OR REPLACE PROCEDURE sp_admin_reopen_profile(
    p_target_user_id UUID,
    p_admin_id UUID,
    p_reason_code TEXT,
    p_notes TEXT,
    p_request_id TEXT,
    p_ip TEXT,
    p_user_agent TEXT
)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE "Users"
    SET "rejectionReason" = NULL, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = p_target_user_id;

    UPDATE "KycVerifications"
    SET "reviewDecision" = 'changesRequested',
        "reviewReasonCode" = p_reason_code,
        "reviewNotes" = p_notes,
        "reviewSections" = ARRAY[]::TEXT[],
        "reviewedAt" = CURRENT_TIMESTAMP,
        "reviewedBy" = p_admin_id,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "userId" = p_target_user_id;

    INSERT INTO "AdminAuditLog" (
        "adminId", "action", "targetId", "notes", "reasonCode",
        "statusBefore", "statusAfter", "requestId", "ipAddress", "userAgent",
        "createdAt"
    )
    VALUES (
        p_admin_id, 'REOPEN_PROFILE', p_target_user_id, p_notes, p_reason_code,
        'rejected', 'needsChanges', p_request_id, p_ip, p_user_agent,
        CURRENT_TIMESTAMP
    );
END;
$$;

CREATE OR REPLACE FUNCTION fn_get_profile_by_user_id(
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'user', jsonb_build_object(
            'id', u."id",
            'name', u."name",
            'email', u."email",
            'mobile', u."mobile",
            'gender', u."gender",
            'profileCreatedBy', u."profileCreatedBy",
            'accountStatus', u."accountStatus",
            'profileReviewStatus', u."profileReviewStatus",
            'profileSubmittedAt', u."profileSubmittedAt",
            'rejectionReason', u."rejectionReason",
            'membershipType', u."membershipType",
            'reviewDecision', (
                SELECT jsonb_build_object(
                    'decision', k."reviewDecision",
                    'reasonCode', k."reviewReasonCode",
                    'notes', k."reviewNotes",
                    'sections', COALESCE(to_jsonb(k."reviewSections"), '[]'::jsonb),
                    'decidedAt', k."reviewedAt"
                )
                FROM "KycVerifications" k
                WHERE k."userId" = u."id" AND k."reviewDecision" IS NOT NULL
            )
        ),
        'profile', (
            SELECT jsonb_build_object(
                'id', p."id",
                'userId', p."userId",
                'profileUid', p."profileUid",
                'profileComplete', p."profileCompletePct",
                'photoVerified', p."photoVerified",
                'idVerified', p."idVerified",
                'personalDetails', COALESCE(to_jsonb(pp.*) - 'profileId', '{}'::jsonb),
                'religiousDetails', COALESCE(to_jsonb(pr.*) - 'profileId', '{}'::jsonb),
                'locationDetails', COALESCE(to_jsonb(pl.*) - 'profileId', '{}'::jsonb),
                'professionalDetails', COALESCE(to_jsonb(pw.*) - 'profileId', '{}'::jsonb),
                'additionalDetails', COALESCE(to_jsonb(pf.*) - 'profileId', '{}'::jsonb)
            )
            FROM "Profiles" p
            LEFT JOIN "ProfilePersonal" pp ON pp."profileId" = p."id"
            LEFT JOIN "ProfileReligious" pr ON pr."profileId" = p."id"
            LEFT JOIN "ProfileLocations" pl ON pl."profileId" = p."id"
            LEFT JOIN "ProfileProfessional" pw ON pw."profileId" = p."id"
            LEFT JOIN "ProfileFamilyBio" pf ON pf."profileId" = p."id"
            WHERE p."userId" = u."id"
        )
    ) INTO v_result
    FROM "Users" u
    WHERE u."id" = p_user_id;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Down Migration

DROP PROCEDURE IF EXISTS sp_admin_reopen_profile(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT);

-- Restore the story 4 decision procedures (they write "accountStatus" directly).
CREATE OR REPLACE PROCEDURE sp_admin_approve_profile(
    p_target_user_id UUID,
    p_admin_id UUID,
    p_reason_code TEXT,
    p_notes TEXT,
    p_request_id TEXT,
    p_ip TEXT,
    p_user_agent TEXT
)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE "Users"
    SET "accountStatus" = 'active',
        "rejectionReason" = NULL,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = p_target_user_id;

    UPDATE "Profiles"
    SET "photoVerified" = true, "idVerified" = true, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "userId" = p_target_user_id;

    CALL sp_admin_record_review(
        p_target_user_id, p_admin_id, 'APPROVE_PROFILE', 'approved', 'approved',
        p_reason_code, p_notes, NULL, p_request_id, p_ip, p_user_agent
    );
END;
$$;

CREATE OR REPLACE PROCEDURE sp_admin_reject_profile(
    p_target_user_id UUID,
    p_admin_id UUID,
    p_reason_code TEXT,
    p_notes TEXT,
    p_request_id TEXT,
    p_ip TEXT,
    p_user_agent TEXT
)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE "Users"
    SET "accountStatus" = 'rejected',
        "rejectionReason" = COALESCE(p_notes, p_reason_code),
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = p_target_user_id;

    CALL sp_admin_record_review(
        p_target_user_id, p_admin_id, 'REJECT_PROFILE', 'rejected', 'failed',
        p_reason_code, p_notes, NULL, p_request_id, p_ip, p_user_agent
    );
END;
$$;

-- Restore fn_get_profile_by_user_id without the review status fields.
CREATE OR REPLACE FUNCTION fn_get_profile_by_user_id(
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'user', jsonb_build_object(
            'id', u."id",
            'name', u."name",
            'email', u."email",
            'mobile', u."mobile",
            'gender', u."gender",
            'profileCreatedBy', u."profileCreatedBy",
            'accountStatus', u."accountStatus",
            'rejectionReason', u."rejectionReason",
            'membershipType', u."membershipType",
            'reviewDecision', (
                SELECT jsonb_build_object(
                    'decision', k."reviewDecision",
                    'reasonCode', k."reviewReasonCode",
                    'notes', k."reviewNotes",
                    'sections', COALESCE(to_jsonb(k."reviewSections"), '[]'::jsonb),
                    'decidedAt', k."reviewedAt"
                )
                FROM "KycVerifications" k
                WHERE k."userId" = u."id" AND k."reviewDecision" IS NOT NULL
            )
        ),
        'profile', (
            SELECT jsonb_build_object(
                'id', p."id",
                'userId', p."userId",
                'profileUid', p."profileUid",
                'profileComplete', p."profileCompletePct",
                'photoVerified', p."photoVerified",
                'idVerified', p."idVerified",
                'personalDetails', COALESCE(to_jsonb(pp.*) - 'profileId', '{}'::jsonb),
                'religiousDetails', COALESCE(to_jsonb(pr.*) - 'profileId', '{}'::jsonb),
                'locationDetails', COALESCE(to_jsonb(pl.*) - 'profileId', '{}'::jsonb),
                'professionalDetails', COALESCE(to_jsonb(pw.*) - 'profileId', '{}'::jsonb),
                'additionalDetails', COALESCE(to_jsonb(pf.*) - 'profileId', '{}'::jsonb)
            )
            FROM "Profiles" p
            LEFT JOIN "ProfilePersonal" pp ON pp."profileId" = p."id"
            LEFT JOIN "ProfileReligious" pr ON pr."profileId" = p."id"
            LEFT JOIN "ProfileLocations" pl ON pl."profileId" = p."id"
            LEFT JOIN "ProfileProfessional" pw ON pw."profileId" = p."id"
            LEFT JOIN "ProfileFamilyBio" pf ON pf."profileId" = p."id"
            WHERE p."userId" = u."id"
        )
    ) INTO v_result
    FROM "Users" u
    WHERE u."id" = p_user_id;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

DROP PROCEDURE IF EXISTS sp_set_profile_review_status(UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT);

DROP INDEX IF EXISTS "idx_users_profileReviewStatus";
ALTER TABLE "Users" DROP CONSTRAINT IF EXISTS "users_profile_review_status_check";
ALTER TABLE "Users"
    DROP COLUMN IF EXISTS "profileSubmittedAt",
    DROP COLUMN IF EXISTS "profileReviewStatus";
