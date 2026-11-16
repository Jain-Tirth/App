-- Up Migration

-- Story 9 follow-up (SEC-16): member-initiated account events. Separate from
-- "AdminAuditLog", which stays admin-only. Append-only; the one permitted
-- update is the purge anonymising a member's rows (member link, ip and user
-- agent cleared, every other column unchanged), under the same purge check as
-- "ConsentRecords". The rows themselves are kept.

CREATE TABLE IF NOT EXISTS "AccountAuditLog" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID REFERENCES "Users"("id"),
    "eventType" VARCHAR(40) NOT NULL,
    "requestId" UUID,
    "ip" TEXT NOT NULL DEFAULT '',
    "userAgent" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "account_audit_log_event_check" CHECK ("eventType" IN (
        'export_requested', 'export_downloaded', 'deletion_requested',
        'deletion_cancelled', 'purge_executed', 'logout_all'
    ))
);

CREATE INDEX IF NOT EXISTS "idx_accountAuditLog_user_time"
    ON "AccountAuditLog" ("userId", "createdAt" DESC);

CREATE OR REPLACE FUNCTION fn_account_audit_log_append_only()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE'
       AND fn_account_purge_permits(OLD."userId")
       AND NEW."userId" IS NULL
       AND NEW."ip" = ''
       AND NEW."userAgent" = ''
       AND NEW."id" = OLD."id"
       AND NEW."eventType" = OLD."eventType"
       AND NEW."requestId" IS NOT DISTINCT FROM OLD."requestId"
       AND NEW."createdAt" = OLD."createdAt"
    THEN
        RETURN NEW;
    END IF;

    RAISE EXCEPTION 'ACCOUNT_AUDIT_LOG_APPEND_ONLY: account audit rows cannot be updated or deleted';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_account_audit_log_append_only ON "AccountAuditLog";
CREATE TRIGGER trg_account_audit_log_append_only
    BEFORE UPDATE OR DELETE ON "AccountAuditLog"
    FOR EACH ROW EXECUTE FUNCTION fn_account_audit_log_append_only();

-- Down Migration

DROP TABLE IF EXISTS "AccountAuditLog";
DROP FUNCTION IF EXISTS fn_account_audit_log_append_only();
