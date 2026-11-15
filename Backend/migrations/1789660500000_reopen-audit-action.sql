-- Up Migration

-- The reopen audit row uses the action name the contract specifies: `reopen`.
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
        p_admin_id, 'reopen', p_target_user_id, p_notes, p_reason_code,
        'rejected', 'needsChanges', p_request_id, p_ip, p_user_agent,
        CURRENT_TIMESTAMP
    );
END;
$$;

-- Down Migration

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
