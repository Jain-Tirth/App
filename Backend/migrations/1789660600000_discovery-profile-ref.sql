-- Up Migration

-- Approved-only discovery (story 6).
--
-- "profileRef" is the only profile identifier members ever see. It is 128 bits
-- from the database CSPRNG (gen_random_bytes), unrelated to "profileUid", and
-- is assigned by the column default so every profile created later gets one
-- without an application change. Existing profiles are backfilled by the same
-- default when the column is added.
ALTER TABLE "Profiles"
    ADD COLUMN IF NOT EXISTS "profileRef" VARCHAR(32)
        DEFAULT encode(gen_random_bytes(16), 'hex');

ALTER TABLE "Profiles" ALTER COLUMN "profileRef" SET NOT NULL;

ALTER TABLE "Profiles"
    ADD CONSTRAINT "profiles_profile_ref_unique" UNIQUE ("profileRef"),
    ADD CONSTRAINT "profiles_profile_ref_format_check"
        CHECK ("profileRef" ~ '^[0-9a-f]{32}$');

-- Search pages by (createdAt, profileRef) descending (keyset pagination).
CREATE INDEX IF NOT EXISTS "idx_profiles_createdAt_profileRef"
    ON "Profiles" ("createdAt" DESC, "profileRef" DESC);

-- Only an individual photo may be served as the profile (primary) photo.
ALTER TABLE "ProfilePhotos"
    ADD COLUMN IF NOT EXISTS "photoKind" VARCHAR(20) NOT NULL DEFAULT 'individual';

ALTER TABLE "ProfilePhotos"
    ADD CONSTRAINT "profile_photos_photo_kind_check"
        CHECK ("photoKind" IN ('individual', 'family', 'group', 'preWedding'));

-- A profile view is recorded at most once per viewer, target and UTC day.
ALTER TABLE "ProfileViews" ADD COLUMN IF NOT EXISTS "viewedOn" DATE;

UPDATE "ProfileViews"
SET "viewedOn" = ("viewedAt" AT TIME ZONE 'UTC')::date
WHERE "viewedOn" IS NULL;

DELETE FROM "ProfileViews" a
USING "ProfileViews" b
WHERE a."viewerId" = b."viewerId"
  AND a."viewedId" = b."viewedId"
  AND a."viewedOn" = b."viewedOn"
  AND a."id" > b."id";

ALTER TABLE "ProfileViews"
    ALTER COLUMN "viewedOn" SET DEFAULT ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date),
    ALTER COLUMN "viewedOn" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "profile_views_viewer_viewed_day_unique"
    ON "ProfileViews" ("viewerId", "viewedId", "viewedOn");

-- Down Migration

DROP INDEX IF EXISTS "profile_views_viewer_viewed_day_unique";
ALTER TABLE "ProfileViews" DROP COLUMN IF EXISTS "viewedOn";
ALTER TABLE "ProfilePhotos" DROP CONSTRAINT IF EXISTS "profile_photos_photo_kind_check";
ALTER TABLE "ProfilePhotos" DROP COLUMN IF EXISTS "photoKind";
DROP INDEX IF EXISTS "idx_profiles_createdAt_profileRef";
ALTER TABLE "Profiles" DROP CONSTRAINT IF EXISTS "profiles_profile_ref_format_check";
ALTER TABLE "Profiles" DROP CONSTRAINT IF EXISTS "profiles_profile_ref_unique";
ALTER TABLE "Profiles" DROP COLUMN IF EXISTS "profileRef";
