-- Up Migration

-- Story 9 follow-up (SEC-23): the anonymising update of "ConsentRecords" was
-- allowed for any writer. It is now allowed only while the purge is running
-- for that member (the purge names the member in the transaction-local setting
-- app.purge_user_id after it has re-checked, under lock, that the deletion is
-- due) and the member still carries a scheduled deletion. A live member's
-- consent row cannot be anonymised.

CREATE OR REPLACE FUNCTION fn_account_purge_permits(target UUID)
RETURNS BOOLEAN AS $$
    SELECT target IS NOT NULL
       AND current_setting('app.purge_user_id', true) = target::text
       AND EXISTS (
           SELECT 1 FROM "Users" u
           WHERE u."id" = target AND u."deletionScheduledPurgeAt" IS NOT NULL
       );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION fn_consent_records_append_only()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE'
       AND fn_account_purge_permits(OLD."userId")
       AND NEW."userId" IS NULL
       AND NEW."userName" = ''
       AND NEW."ip" = ''
       AND NEW."userAgent" = ''
       AND NEW."id" = OLD."id"
       AND NEW."code" = OLD."code"
       AND NEW."version" = OLD."version"
       AND NEW."documentHash" = OLD."documentHash"
       AND NEW."textSnapshot" = OLD."textSnapshot"
       AND NEW."language" = OLD."language"
       AND NEW."grantedAt" = OLD."grantedAt"
       AND NEW."expiresAt" = OLD."expiresAt"
       AND NEW."revokedAt" IS NOT DISTINCT FROM OLD."revokedAt"
       AND NEW."source" = OLD."source"
       AND NEW."createdAt" = OLD."createdAt"
       AND NEW."updatedAt" = OLD."updatedAt"
    THEN
        RETURN NEW;
    END IF;

    RAISE EXCEPTION 'CONSENT_RECORDS_APPEND_ONLY: consent records cannot be updated or deleted';
END;
$$ LANGUAGE plpgsql;

-- Down Migration

-- Back to the function of migration 1789660900000 (anonymising shape allowed
-- without a purge check).
CREATE OR REPLACE FUNCTION fn_consent_records_append_only()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE'
       AND OLD."userId" IS NOT NULL
       AND NEW."userId" IS NULL
       AND NEW."userName" = ''
       AND NEW."ip" = ''
       AND NEW."userAgent" = ''
       AND NEW."id" = OLD."id"
       AND NEW."code" = OLD."code"
       AND NEW."version" = OLD."version"
       AND NEW."documentHash" = OLD."documentHash"
       AND NEW."textSnapshot" = OLD."textSnapshot"
       AND NEW."language" = OLD."language"
       AND NEW."grantedAt" = OLD."grantedAt"
       AND NEW."expiresAt" = OLD."expiresAt"
       AND NEW."revokedAt" IS NOT DISTINCT FROM OLD."revokedAt"
       AND NEW."source" = OLD."source"
       AND NEW."createdAt" = OLD."createdAt"
       AND NEW."updatedAt" = OLD."updatedAt"
    THEN
        RETURN NEW;
    END IF;

    RAISE EXCEPTION 'CONSENT_RECORDS_APPEND_ONLY: consent records cannot be updated or deleted';
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS fn_account_purge_permits(UUID);
