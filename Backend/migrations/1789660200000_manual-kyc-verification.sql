-- Up Migration

-- Manual KYC (story 3). The legacy "IdVerifications" and "ProfilePhotos" tables
-- are left untouched: "IdVerifications" is bound to the pending/approved/rejected
-- "ValidationStatus" enum and carries OCR and face-match columns that the manual
-- flow never fills, so it cannot hold the notStarted -> needsReview states.

CREATE TABLE IF NOT EXISTS "KycVerifications" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL UNIQUE REFERENCES "Users"("id") ON DELETE CASCADE,
    "status" TEXT NOT NULL,
    "providerSessionId" TEXT NOT NULL,
    "documentType" TEXT,
    "idNumberEncrypted" TEXT,
    "idNumberLast4" VARCHAR(4),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "kyc_verifications_status_check" CHECK (
        "status" IN ('consentGiven', 'documentUploaded', 'needsReview',
                     'changesNeeded', 'failed', 'approved')
    ),
    CONSTRAINT "kyc_verifications_document_type_check" CHECK (
        "documentType" IS NULL OR "documentType" IN
            ('aadhaar', 'pan', 'drivingLicence', 'rationCard', 'voterId', 'other')
    )
);

CREATE TABLE IF NOT EXISTS "KycMedia" (
    "id" UUID PRIMARY KEY,
    "verificationId" UUID NOT NULL REFERENCES "KycVerifications"("id") ON DELETE CASCADE,
    "userId" UUID NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
    "purpose" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "storageKey" TEXT NOT NULL UNIQUE,
    "checksum" TEXT,
    "attachedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "kyc_media_purpose_check" CHECK ("purpose" IN ('kycPhoto', 'kycId')),
    CONSTRAINT "kyc_media_size_check" CHECK ("sizeBytes" > 0 AND "sizeBytes" <= 10485760)
);

-- One attached file per purpose per case.
CREATE UNIQUE INDEX IF NOT EXISTS "kyc_media_one_attached_per_purpose"
    ON "KycMedia" ("verificationId", "purpose")
    WHERE "attachedAt" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_kycMedia_verificationId" ON "KycMedia" ("verificationId");

CREATE TABLE IF NOT EXISTS "KycRestarts" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "verificationId" UUID NOT NULL REFERENCES "KycVerifications"("id") ON DELETE CASCADE,
    "restartedAt" TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_kycRestarts_verification_time"
    ON "KycRestarts" ("verificationId", "restartedAt");

-- Down Migration

DROP TABLE IF EXISTS "KycRestarts";
DROP TABLE IF EXISTS "KycMedia";
DROP TABLE IF EXISTS "KycVerifications";
