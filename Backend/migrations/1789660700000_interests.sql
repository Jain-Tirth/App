-- Up Migration

-- Interests (story 7). `withdrawn` is a member action; `expired` is reserved
-- for the later expiry job and is never written in Phase 1.
ALTER TYPE "InterestStatus" ADD VALUE IF NOT EXISTS 'withdrawn';
ALTER TYPE "InterestStatus" ADD VALUE IF NOT EXISTS 'expired';

-- A declined or withdrawn interest must not block a later one, so the
-- all-status unique constraint becomes a partial unique index over the
-- active states only.
ALTER TABLE "Interests" DROP CONSTRAINT IF EXISTS "interests_sender_receiver_unique";

CREATE UNIQUE INDEX IF NOT EXISTS "interests_active_pair_unique"
    ON "Interests" ("senderId", "receiverId")
    WHERE "status" IN ('pending', 'accepted');

ALTER TABLE "Interests"
    ADD CONSTRAINT "interests_no_self_check" CHECK ("senderId" <> "receiverId");

-- Set by an admin to lift the resend cooldown that follows a decline.
ALTER TABLE "Interests" ADD COLUMN IF NOT EXISTS "cooldownClearedAt" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "idx_interests_sender_created"
    ON "Interests" ("senderId", "createdAt" DESC, "id" DESC);
CREATE INDEX IF NOT EXISTS "idx_interests_receiver_created"
    ON "Interests" ("receiverId", "createdAt" DESC, "id" DESC);

-- One row per transition, written in the same transaction as the change.
CREATE TABLE IF NOT EXISTS "InterestEvents" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "interestId" UUID NOT NULL REFERENCES "Interests"("id") ON DELETE CASCADE,
    "actorId" UUID NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
    "fromStatus" VARCHAR(20),
    "toStatus" VARCHAR(20) NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "interest_events_status_check" CHECK (
        "toStatus" IN ('pending', 'accepted', 'declined', 'withdrawn', 'expired')
        AND ("fromStatus" IS NULL
             OR "fromStatus" IN ('pending', 'accepted', 'declined', 'withdrawn', 'expired'))
    )
);

CREATE INDEX IF NOT EXISTS "idx_interestEvents_interestId"
    ON "InterestEvents" ("interestId", "createdAt");

-- The second member an admin action concerns (the receiver, for a cooldown clear).
ALTER TABLE "AdminAuditLog" ADD COLUMN IF NOT EXISTS "relatedId" UUID;

-- Down Migration

ALTER TABLE "AdminAuditLog" DROP COLUMN IF EXISTS "relatedId";
DROP TABLE IF EXISTS "InterestEvents";
DROP INDEX IF EXISTS "idx_interests_receiver_created";
DROP INDEX IF EXISTS "idx_interests_sender_created";
ALTER TABLE "Interests" DROP COLUMN IF EXISTS "cooldownClearedAt";
ALTER TABLE "Interests" DROP CONSTRAINT IF EXISTS "interests_no_self_check";
DROP INDEX IF EXISTS "interests_active_pair_unique";
-- Enum values cannot be dropped; 'withdrawn' and 'expired' stay in "InterestStatus".
