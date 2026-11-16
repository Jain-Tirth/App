-- Up Migration

-- Named shortlists (story 8). The flat "Shortlists" table (one row per
-- member and target) becomes a list table plus a membership table; every
-- existing flat row moves into its member's default list.
CREATE TABLE "ShortlistLists" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
    "name" VARCHAR(100) NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shortlist_lists_name_check"
        CHECK (char_length(btrim("name")) BETWEEN 1 AND 100)
);

CREATE UNIQUE INDEX "shortlist_lists_user_name_unique"
    ON "ShortlistLists" ("userId", lower("name"));
CREATE UNIQUE INDEX "shortlist_lists_one_default"
    ON "ShortlistLists" ("userId") WHERE "isDefault";

CREATE TABLE "ShortlistProfiles" (
    "listId" UUID NOT NULL REFERENCES "ShortlistLists"("id") ON DELETE CASCADE,
    "targetId" UUID NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("listId", "targetId")
);

CREATE INDEX "idx_shortlistProfiles_targetId" ON "ShortlistProfiles" ("targetId");

INSERT INTO "ShortlistLists" ("userId", "name", "isDefault")
SELECT DISTINCT "userId", 'Shortlisted', true FROM "Shortlists";

INSERT INTO "ShortlistProfiles" ("listId", "targetId", "createdAt")
SELECT l."id", s."targetId", s."createdAt"
FROM "Shortlists" s
JOIN "ShortlistLists" l ON l."userId" = s."userId" AND l."isDefault";

DROP TABLE "Shortlists";

-- Down Migration

CREATE TABLE "Shortlists" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
    "targetId" UUID NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shortlists_user_target_unique" UNIQUE ("userId", "targetId")
);

CREATE INDEX "idx_shortlists_userId" ON "Shortlists"("userId");
CREATE INDEX "idx_shortlists_targetId" ON "Shortlists"("targetId");

-- A target in several lists collapses to one flat row (earliest addition).
INSERT INTO "Shortlists" ("userId", "targetId", "createdAt")
SELECT l."userId", sp."targetId", min(sp."createdAt")
FROM "ShortlistProfiles" sp
JOIN "ShortlistLists" l ON l."id" = sp."listId"
GROUP BY l."userId", sp."targetId";

DROP TABLE "ShortlistProfiles";
DROP TABLE "ShortlistLists";
