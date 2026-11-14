-- Up Migration

-- Admin manual KYC review (story 4).
-- A decision is stored on the KYC case so GET /profiles/me can show it, and the
-- audit log gains the fields the review audit needs. "statusBefore" and
-- "statusAfter" hold the KYC case status (needsReview -> approved, failed or
-- changesNeeded): that is the state a review changes until story 5 adds the
-- profile status machine.

ALTER TABLE "AdminAuditLog"
    ADD COLUMN IF NOT EXISTS "reasonCode" VARCHAR(50),
    ADD COLUMN IF NOT EXISTS "statusBefore" VARCHAR(30),
    ADD COLUMN IF NOT EXISTS "statusAfter" VARCHAR(30),
    ADD COLUMN IF NOT EXISTS "requestId" VARCHAR(100),
    ADD COLUMN IF NOT EXISTS "ipAddress" VARCHAR(64),
    ADD COLUMN IF NOT EXISTS "userAgent" TEXT;

ALTER TABLE "KycVerifications"
    ADD COLUMN IF NOT EXISTS "reviewDecision" TEXT,
    ADD COLUMN IF NOT EXISTS "reviewReasonCode" VARCHAR(50),
    ADD COLUMN IF NOT EXISTS "reviewNotes" TEXT,
    ADD COLUMN IF NOT EXISTS "reviewSections" TEXT[],
    ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "reviewedBy" UUID REFERENCES "Users"("id") ON DELETE SET NULL;

ALTER TABLE "KycVerifications"
    ADD CONSTRAINT "kyc_verifications_review_decision_check" CHECK (
        "reviewDecision" IS NULL OR "reviewDecision" IN
            ('approved', 'rejected', 'changesRequested')
    );

-- Shared by the three decision procedures: stores the decision on the case and
-- writes the one audit row. Runs inside the caller's transaction.
CREATE OR REPLACE PROCEDURE sp_admin_record_review(
    p_target_user_id UUID,
    p_admin_id UUID,
    p_action VARCHAR,
    p_decision TEXT,
    p_kyc_status_after TEXT,
    p_reason_code TEXT,
    p_notes TEXT,
    p_sections TEXT[],
    p_request_id TEXT,
    p_ip TEXT,
    p_user_agent TEXT
)
LANGUAGE plpgsql AS $$
DECLARE
    v_kyc_before TEXT;
BEGIN
    SELECT "status" INTO v_kyc_before
    FROM "KycVerifications" WHERE "userId" = p_target_user_id;

    UPDATE "KycVerifications"
    SET "status" = p_kyc_status_after,
        "reviewDecision" = p_decision,
        "reviewReasonCode" = p_reason_code,
        "reviewNotes" = p_notes,
        "reviewSections" = p_sections,
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
        p_admin_id, p_action, p_target_user_id, p_notes, p_reason_code,
        v_kyc_before, p_kyc_status_after, p_request_id, p_ip, p_user_agent,
        CURRENT_TIMESTAMP
    );
END;
$$;

DROP PROCEDURE IF EXISTS sp_admin_approve_profile(UUID, UUID);
DROP PROCEDURE IF EXISTS sp_admin_reject_profile(UUID, UUID, TEXT);

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

-- "AccountStatus" has no changes-requested value until story 5, so the account
-- stays 'pending'; the KYC case moves to changesNeeded.
CREATE OR REPLACE PROCEDURE sp_admin_request_changes(
    p_target_user_id UUID,
    p_admin_id UUID,
    p_reason_code TEXT,
    p_notes TEXT,
    p_sections TEXT[],
    p_request_id TEXT,
    p_ip TEXT,
    p_user_agent TEXT
)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE "Users"
    SET "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = p_target_user_id;

    CALL sp_admin_record_review(
        p_target_user_id, p_admin_id, 'REQUEST_CHANGES', 'changesRequested',
        'changesNeeded', p_reason_code, p_notes, p_sections, p_request_id, p_ip,
        p_user_agent
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

DROP PROCEDURE IF EXISTS sp_admin_request_changes(UUID, UUID, TEXT, TEXT, TEXT[], TEXT, TEXT, TEXT);
DROP PROCEDURE IF EXISTS sp_admin_reject_profile(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP PROCEDURE IF EXISTS sp_admin_approve_profile(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP PROCEDURE IF EXISTS sp_admin_record_review(UUID, UUID, VARCHAR, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT, TEXT, TEXT);

CREATE OR REPLACE PROCEDURE sp_admin_approve_profile(
    p_target_user_id UUID,
    p_admin_id UUID
)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE "Users"
    SET "accountStatus" = 'active',
        "rejectionReason" = NULL,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = p_target_user_id;

    INSERT INTO "AdminAuditLog" ("adminId", "action", "targetId", "notes", "createdAt")
    VALUES (p_admin_id, 'APPROVE_PROFILE', p_target_user_id, 'Profile approved by admin', CURRENT_TIMESTAMP);
END;
$$;

CREATE OR REPLACE PROCEDURE sp_admin_reject_profile(
    p_target_user_id UUID,
    p_admin_id UUID,
    p_reason TEXT
)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE "Users"
    SET "accountStatus" = 'rejected',
        "rejectionReason" = p_reason,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = p_target_user_id;

    INSERT INTO "AdminAuditLog" ("adminId", "action", "targetId", "notes", "createdAt")
    VALUES (p_admin_id, 'REJECT_PROFILE', p_target_user_id, p_reason, CURRENT_TIMESTAMP);
END;
$$;

ALTER TABLE "KycVerifications" DROP CONSTRAINT IF EXISTS "kyc_verifications_review_decision_check";
ALTER TABLE "KycVerifications"
    DROP COLUMN IF EXISTS "reviewedBy",
    DROP COLUMN IF EXISTS "reviewedAt",
    DROP COLUMN IF EXISTS "reviewSections",
    DROP COLUMN IF EXISTS "reviewNotes",
    DROP COLUMN IF EXISTS "reviewReasonCode",
    DROP COLUMN IF EXISTS "reviewDecision";

ALTER TABLE "AdminAuditLog"
    DROP COLUMN IF EXISTS "userAgent",
    DROP COLUMN IF EXISTS "ipAddress",
    DROP COLUMN IF EXISTS "requestId",
    DROP COLUMN IF EXISTS "statusAfter",
    DROP COLUMN IF EXISTS "statusBefore",
    DROP COLUMN IF EXISTS "reasonCode";

-- Restore the previous fn_get_profile_by_user_id (without 'reviewDecision').
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
            'membershipType', u."membershipType"
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
