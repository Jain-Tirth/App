-- Up Migration

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────
-- VERSIONED CONSENT DOCUMENTS
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "ConsentDocuments" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "code" VARCHAR(50) NOT NULL,
    "version" VARCHAR(50) NOT NULL,
    "documentHash" TEXT NOT NULL,
    "effectiveAt" TIMESTAMPTZ NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "consent_documents_code_version_unique" UNIQUE ("code", "version")
);

-- Only one version of a consent code may be active at a time.
CREATE UNIQUE INDEX IF NOT EXISTS "consent_documents_one_active_per_code"
    ON "ConsentDocuments" ("code")
    WHERE "isActive" = true;

CREATE TABLE IF NOT EXISTS "ConsentDocumentTranslations" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "documentId" UUID NOT NULL REFERENCES "ConsentDocuments"("id") ON DELETE CASCADE,
    "language" VARCHAR(5) NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "consent_document_translations_document_language_unique"
        UNIQUE ("documentId", "language"),
    CONSTRAINT "consent_document_translations_language_check"
        CHECK ("language" IN ('en', 'hi', 'gu'))
);

-- ─────────────────────────────────────────────
-- APPEND-ONLY CONSENT RECORDS
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "ConsentRecords" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL REFERENCES "Users"("id") ON DELETE RESTRICT,
    "userName" VARCHAR(100) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "version" VARCHAR(50) NOT NULL,
    "documentHash" TEXT NOT NULL,
    "textSnapshot" TEXT NOT NULL,
    "language" VARCHAR(5) NOT NULL DEFAULT 'en',
    "ip" TEXT NOT NULL DEFAULT '',
    "userAgent" TEXT NOT NULL DEFAULT '',
    "grantedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "revokedAt" TIMESTAMPTZ,
    "source" VARCHAR(50) NOT NULL DEFAULT 'api',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "consent_records_language_check"
        CHECK ("language" IN ('en', 'hi', 'gu')),
    CONSTRAINT "consent_records_source_check"
        CHECK ("source" IN ('registration', 'api', 'renewal'))
);

CREATE INDEX IF NOT EXISTS "idx_consent_records_user_granted"
    ON "ConsentRecords" ("userId", "grantedAt" DESC);

CREATE INDEX IF NOT EXISTS "idx_consent_records_user_code_granted"
    ON "ConsentRecords" ("userId", "code", "grantedAt" DESC);

-- Consent records are evidence: they are never edited or deleted in place.
CREATE OR REPLACE FUNCTION fn_consent_records_append_only()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'CONSENT_RECORDS_APPEND_ONLY: consent records cannot be updated or deleted';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_consent_records_append_only ON "ConsentRecords";
CREATE TRIGGER trg_consent_records_append_only
    BEFORE UPDATE OR DELETE ON "ConsentRecords"
    FOR EACH ROW EXECUTE FUNCTION fn_consent_records_append_only();

-- ─────────────────────────────────────────────
-- SEED: terms, privacy and ID-processing documents
-- The document hash is the SHA-256 of the canonical English text.
-- ─────────────────────────────────────────────

INSERT INTO "ConsentDocuments" ("code", "version", "documentHash", "effectiveAt", "isActive")
SELECT
    v."code",
    v."version",
    encode(digest(v."en_text", 'sha256'), 'hex'),
    v."effective_at",
    true
FROM (VALUES
    (
        'terms',
        '1.0',
        $txt$I agree to the Dhobi Matrimony Terms of Use. I will provide accurate information, respect other members and use the platform only for lawful marriage-related purposes.$txt$,
        TIMESTAMPTZ '2026-11-01T00:00:00Z'
    ),
    (
        'privacy',
        '1.0',
        $txt$I have read the Dhobi Matrimony Privacy Policy. I understand how my personal data is collected, used, stored and shared, and I consent to that processing.$txt$,
        TIMESTAMPTZ '2026-11-01T00:00:00Z'
    ),
    (
        'id_processing',
        '1.0',
        $txt$I consent to Dhobi Matrimony processing my government ID and member photo for identity verification. This includes manual review by an authorised admin, 24-month retention, and my right to withdraw consent by deleting my account.$txt$,
        TIMESTAMPTZ '2026-11-01T00:00:00Z'
    )
) AS v("code", "version", "en_text", "effective_at")
ON CONFLICT ("code", "version") DO NOTHING;

INSERT INTO "ConsentDocumentTranslations" ("documentId", "language", "text")
SELECT d."id", t."language", t."text"
FROM (VALUES
    (
        'terms',
        'en',
        $txt$I agree to the Dhobi Matrimony Terms of Use. I will provide accurate information, respect other members and use the platform only for lawful marriage-related purposes.$txt$
    ),
    (
        'terms',
        'hi',
        $txt$मैं धोबी मैट्रिमोनी की उपयोग शर्तों से सहमत हूँ। मैं सही जानकारी दूँगा/दूँगी, अन्य सदस्यों का सम्मान करूँगा/करूँगी और प्लेटफ़ॉर्म का उपयोग केवल वैध विवाह-संबंधी उद्देश्यों के लिए करूँगा/करूँगी।$txt$
    ),
    (
        'terms',
        'gu',
        $txt$હું ધોબી મેટ્રિમોનીની ઉપયોગની શરતો સાથે સહમત છું. હું સાચી માહિતી આપીશ, અન્ય સભ્યોનું સન્માન કરીશ અને પ્લેટફોર્મનો ઉપયોગ ફક્ત કાયદેસર લગ્નસંબંધી હેતુઓ માટે કરીશ.$txt$
    ),
    (
        'privacy',
        'en',
        $txt$I have read the Dhobi Matrimony Privacy Policy. I understand how my personal data is collected, used, stored and shared, and I consent to that processing.$txt$
    ),
    (
        'privacy',
        'hi',
        $txt$मैंने धोबी मैट्रिमोनी की गोपनीयता नीति पढ़ी है। मैं समझता/समझती हूँ कि मेरा व्यक्तिगत डेटा कैसे एकत्र, उपयोग, संग्रहीत और साझा किया जाता है, और मैं उस प्रोसेसिंग के लिए सहमति देता/देती हूँ।$txt$
    ),
    (
        'privacy',
        'gu',
        $txt$મેં ધોબી મેટ્રિમોનીની ગોપનીયતા નીતિ વાંચી છે. હું સમજું છું કે મારો વ્યક્તિગત ડેટા કેવી રીતે એકત્રિત, ઉપયોગ, સંગ્રહિત અને શેર કરવામાં આવે છે, અને હું તે પ્રોસેસિંગ માટે સંમતિ આપું છું.$txt$
    ),
    (
        'id_processing',
        'en',
        $txt$I consent to Dhobi Matrimony processing my government ID and member photo for identity verification. This includes manual review by an authorised admin, 24-month retention, and my right to withdraw consent by deleting my account.$txt$
    ),
    (
        'id_processing',
        'hi',
        $txt$मैं धोबी मैट्रिमोनी को पहचान सत्यापन के लिए अपनी सरकारी आईडी और सदस्य फ़ोटो संसाधित करने की सहमति देता/देती हूँ। इसमें अधिकृत एडमिन द्वारा मैन्युअल समीक्षा, 24 महीने तक डेटा रखना और खाता हटाकर सहमति वापस लेने का मेरा अधिकार शामिल है।$txt$
    ),
    (
        'id_processing',
        'gu',
        $txt$હું ધોબી મેટ્રિમોનીને ઓળખ ચકાસણી માટે મારી સરકારી આઈડી અને સભ્ય ફોટો પ્રોસેસ કરવાની સંમતિ આપું છું. આમાં અધિકૃત એડમિન દ્વારા મેન્યુઅલ સમીક્ષા, 24 મહિના સુધી ડેટા રાખવો અને ખાતું ડિલીટ કરીને સંમતિ પાછી ખેંચવાનો મારો અધિકાર સમાવેશ થાય છે.$txt$
    )
) AS t("code", "language", "text")
JOIN "ConsentDocuments" d
    ON d."code" = t."code" AND d."version" = '1.0'
ON CONFLICT ("documentId", "language") DO NOTHING;

-- Down Migration

DROP TABLE IF EXISTS "ConsentRecords" CASCADE;
DROP TABLE IF EXISTS "ConsentDocumentTranslations" CASCADE;
DROP TABLE IF EXISTS "ConsentDocuments" CASCADE;
DROP FUNCTION IF EXISTS fn_consent_records_append_only();
