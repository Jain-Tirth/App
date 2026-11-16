-- Up Migration

-- Account settings, logout-all, export and deletion (story 9).

-- Settings, the access-token revocation counter and the deletion schedule live
-- on "Users": every one of them is read on the member's own row.
ALTER TABLE "Users"
    ADD COLUMN IF NOT EXISTS "language" VARCHAR(2) NOT NULL DEFAULT 'en',
    ADD COLUMN IF NOT EXISTS "notificationPrefs" JSONB NOT NULL DEFAULT
        '{"interestReceived":true,"interestAccepted":true,"profileApproved":true,"newMessage":true,"profileViewed":true}'::jsonb,
    ADD COLUMN IF NOT EXISTS "profileVisibility" VARCHAR(10) NOT NULL DEFAULT 'all',
    -- Bumped by logout-all. An access token carries the value it was issued
    -- under and is rejected once the row holds a different one.
    ADD COLUMN IF NOT EXISTS "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "deletionRequestedAt" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "deletionScheduledPurgeAt" TIMESTAMPTZ;

ALTER TABLE "Users"
    ADD CONSTRAINT "users_language_check" CHECK ("language" IN ('en', 'hi', 'gu')),
    ADD CONSTRAINT "users_profile_visibility_check"
        CHECK ("profileVisibility" IN ('all', 'hidden')),
    ADD CONSTRAINT "users_deletion_schedule_check" CHECK (
        ("deletionRequestedAt" IS NULL) = ("deletionScheduledPurgeAt" IS NULL)
    );

CREATE INDEX IF NOT EXISTS "idx_users_deletionScheduledPurgeAt"
    ON "Users" ("deletionScheduledPurgeAt")
    WHERE "deletionScheduledPurgeAt" IS NOT NULL;

-- One row per export request. The archive is built on the first download and
-- kept until the row is purged with the member.
CREATE TABLE IF NOT EXISTS "AccountExportRequests" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
    "status" VARCHAR(10) NOT NULL DEFAULT 'pending',
    "requestedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "archive" JSONB,
    "generatedAt" TIMESTAMPTZ,
    CONSTRAINT "account_export_requests_status_check"
        CHECK ("status" IN ('pending', 'ready'))
);

CREATE INDEX IF NOT EXISTS "idx_accountExportRequests_user"
    ON "AccountExportRequests" ("userId", "requestedAt" DESC);

-- Failed password step-up attempts, counted per member over a window.
CREATE TABLE IF NOT EXISTS "StepUpFailures" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
    "failedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_stepUpFailures_user_time"
    ON "StepUpFailures" ("userId", "failedAt" DESC);

-- Consent records outlive the member with the identifying fields stripped, so
-- the link to the member becomes optional.
ALTER TABLE "ConsentRecords" ALTER COLUMN "userId" DROP NOT NULL;

-- Records stay append-only, with exactly one exception: the anonymising update
-- the purge makes (identity columns cleared, every other column unchanged).
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

-- Down Migration

-- Anonymised consent rows cannot be given back an identity, and the old
-- schema has no place for a row without one: they are removed (the only
-- deletion of consent evidence in the codebase, and only when this migration
-- is reverted) before the strict trigger and NOT NULL come back.
ALTER TABLE "ConsentRecords" DISABLE TRIGGER trg_consent_records_append_only;
DELETE FROM "ConsentRecords" WHERE "userId" IS NULL;
ALTER TABLE "ConsentRecords" ENABLE TRIGGER trg_consent_records_append_only;

CREATE OR REPLACE FUNCTION fn_consent_records_append_only()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'CONSENT_RECORDS_APPEND_ONLY: consent records cannot be updated or deleted';
END;
$$ LANGUAGE plpgsql;

ALTER TABLE "ConsentRecords" ALTER COLUMN "userId" SET NOT NULL;

DROP TABLE IF EXISTS "StepUpFailures";
DROP TABLE IF EXISTS "AccountExportRequests";

DROP INDEX IF EXISTS "idx_users_deletionScheduledPurgeAt";

ALTER TABLE "Users"
    DROP CONSTRAINT IF EXISTS "users_deletion_schedule_check",
    DROP CONSTRAINT IF EXISTS "users_profile_visibility_check",
    DROP CONSTRAINT IF EXISTS "users_language_check";

ALTER TABLE "Users"
    DROP COLUMN IF EXISTS "deletionScheduledPurgeAt",
    DROP COLUMN IF EXISTS "deletionRequestedAt",
    DROP COLUMN IF EXISTS "sessionVersion",
    DROP COLUMN IF EXISTS "profileVisibility",
    DROP COLUMN IF EXISTS "notificationPrefs",
    DROP COLUMN IF EXISTS "language";
