-- ============================================================
-- DHOBI MATRIMONY — Scalable Normalized PostgreSQL Schema (3NF)
-- - Tables & Enums: PascalCase (double quoted)
-- - Columns & Enum Values: camelCase
-- - Enums Removed: FamilyStatus, ResidentStatus, InterestSentVia
-- - Zero OTP columns in DB (Stateless Encrypted/Signed JWT OTP)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────
-- ENUMS (PascalCase, camelCase values)
-- ─────────────────────────────────────────────

DO $$ BEGIN
    CREATE TYPE "Role" AS ENUM ('user', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "MembershipType" AS ENUM ('regular', 'prime');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "AccountStatus" AS ENUM ('pending', 'active', 'rejected', 'blocked');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ProfileCreatedBy" AS ENUM ('myself', 'son', 'daughter', 'brother', 'sister', 'friend', 'relative');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "Gender" AS ENUM ('male', 'female');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "PhysicalStatus" AS ENUM ('normal', 'physicallyChallenged');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "MaritalStatus" AS ENUM ('neverMarried', 'widower', 'awaitingDivorce', 'divorced');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "EatingHabits" AS ENUM ('vegetarian', 'nonVegetarian', 'eggetarian');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "Dosh" AS ENUM ('no', 'yes', 'dontKnow');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "EmploymentType" AS ENUM ('private', 'business', 'defence', 'governmentPsu', 'notWorking', 'selfEmployed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ValidationStatus" AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "DocumentType" AS ENUM ('aadhaar', 'pan', 'drivingLicence', 'voterId', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "InterestStatus" AS ENUM ('pending', 'accepted', 'declined');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "NotificationType" AS ENUM ('interestReceived', 'interestAccepted', 'profileApproved', 'newMessage', 'profileViewed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ─────────────────────────────────────────────
-- 1. IDENTITY & SESSIONS DOMAIN
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "Users" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(150) NOT NULL UNIQUE,
    "passwordHash" TEXT NOT NULL,
    "mobile" VARCHAR(15) NOT NULL UNIQUE,
    "mobileVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "role" "Role" NOT NULL DEFAULT 'user',
    "membershipType" "MembershipType" NOT NULL DEFAULT 'regular',
    "accountStatus" "AccountStatus" NOT NULL DEFAULT 'pending',
    "rejectionReason" TEXT,
    "profileCreatedBy" "ProfileCreatedBy",
    "gender" "Gender",
    "lastSeen" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Separate session table: stores ONLY refresh tokens. Zero OTP data.
CREATE TABLE IF NOT EXISTS "UserSessions" (
    "userId" UUID PRIMARY KEY REFERENCES "Users"("id") ON DELETE CASCADE,
    "refreshTokenHash" TEXT,
    "refreshTokenExpiresAt" TIMESTAMPTZ,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────
-- 2. PROFILE CORE & STEP-BASED WIZARD DOMAIN
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "Profiles" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL UNIQUE REFERENCES "Users"("id") ON DELETE CASCADE,
    "profileUid" VARCHAR(15) UNIQUE,
    "profileCompletePct" INTEGER NOT NULL DEFAULT 0,
    "photoVerified" BOOLEAN NOT NULL DEFAULT false,
    "idVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Step 1: Physical & Personal details
CREATE TABLE IF NOT EXISTS "ProfilePersonal" (
    "profileId" UUID PRIMARY KEY REFERENCES "Profiles"("id") ON DELETE CASCADE,
    "dateOfBirth" DATE NOT NULL,
    "heightCm" INTEGER,
    "weightKg" INTEGER,
    "physicalStatus" "PhysicalStatus",
    "maritalStatus" "MaritalStatus",
    "spokenLanguages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "eatingHabits" "EatingHabits",
    "residentStatus" VARCHAR(50), -- Plain varchar without enum
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Step 2: Religious details
CREATE TABLE IF NOT EXISTS "ProfileReligious" (
    "profileId" UUID PRIMARY KEY REFERENCES "Profiles"("id") ON DELETE CASCADE,
    "religion" VARCHAR(50),
    "caste" VARCHAR(100),
    "subcaste" VARCHAR(100),
    "openToAnySubcaste" BOOLEAN NOT NULL DEFAULT false,
    "gothra" VARCHAR(100),
    "dosh" "Dosh",
    "manglik" "Dosh",
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Step 3: Location details
CREATE TABLE IF NOT EXISTS "ProfileLocations" (
    "profileId" UUID PRIMARY KEY REFERENCES "Profiles"("id") ON DELETE CASCADE,
    "country" VARCHAR(100),
    "state" VARCHAR(100),
    "city" VARCHAR(100),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Step 4: Professional details
CREATE TABLE IF NOT EXISTS "ProfileProfessional" (
    "profileId" UUID PRIMARY KEY REFERENCES "Profiles"("id") ON DELETE CASCADE,
    "education" VARCHAR(150),
    "employmentType" "EmploymentType",
    "occupation" VARCHAR(150),
    "incomeCurrency" VARCHAR(10) DEFAULT 'INR',
    "annualIncomeRange" VARCHAR(50),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Step 5: Bio and Family details
CREATE TABLE IF NOT EXISTS "ProfileFamilyBio" (
    "profileId" UUID PRIMARY KEY REFERENCES "Profiles"("id") ON DELETE CASCADE,
    "familyStatus" VARCHAR(50), -- Plain varchar without enum
    "aboutMyself" TEXT,
    "lookingFor" TEXT,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Lifestyle details
CREATE TABLE IF NOT EXISTS "ProfileLifestyle" (
    "profileId" UUID PRIMARY KEY REFERENCES "Profiles"("id") ON DELETE CASCADE,
    "smokingHabits" VARCHAR(30),
    "drinkingHabits" VARCHAR(30),
    "cuisine" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hobbies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "music" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "movies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "books" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Horoscope details
CREATE TABLE IF NOT EXISTS "ProfileHoroscope" (
    "profileId" UUID PRIMARY KEY REFERENCES "Profiles"("id") ON DELETE CASCADE,
    "birthTime" TIME,
    "birthPlaceCountry" VARCHAR(100),
    "star" VARCHAR(50),
    "raasi" VARCHAR(50),
    "kundliScore" INTEGER,
    "horoscopeFileUrl" TEXT,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────
-- 3. PARTNER PREFERENCES DOMAIN
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "PartnerPreferences" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL UNIQUE REFERENCES "Users"("id") ON DELETE CASCADE,
    "prefAgeMin" INTEGER,
    "prefAgeMax" INTEGER,
    "prefHeightMinCm" INTEGER,
    "prefHeightMaxCm" INTEGER,
    "prefMaritalStatus" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "prefMotherTongue" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "prefPhysicalStatus" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "prefEatingHabits" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "prefSmokingHabits" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "prefDrinkingHabits" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "PartnerPrefReligious" (
    "prefId" UUID PRIMARY KEY REFERENCES "PartnerPreferences"("id") ON DELETE CASCADE,
    "prefReligion" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "prefCaste" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "prefSubcaste" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "openToAnyCaste" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "PartnerPrefLocation" (
    "prefId" UUID PRIMARY KEY REFERENCES "PartnerPreferences"("id") ON DELETE CASCADE,
    "prefCountry" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "prefState" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "prefCity" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "prefCitizenship" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "PartnerPrefCareer" (
    "prefId" UUID PRIMARY KEY REFERENCES "PartnerPreferences"("id") ON DELETE CASCADE,
    "prefEducation" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "prefEmploymentType" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "prefOccupation" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "prefIncomeMin" INTEGER,
    "prefIncomeMax" INTEGER,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────
-- 4. MEDIA & VERIFICATIONS
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "ProfilePhotos" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
    "fileUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "validationStatus" "ValidationStatus" NOT NULL DEFAULT 'pending',
    "uploadedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "IdVerifications" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
    "documentType" "DocumentType" NOT NULL,
    "documentNumber" TEXT,
    "frontImageUrl" TEXT,
    "backImageUrl" TEXT,
    "selfieUrl" TEXT,
    "ocrName" TEXT,
    "ocrDob" DATE,
    "ocrConfidence" DOUBLE PRECISION,
    "faceMatchScore" DOUBLE PRECISION,
    "ageVerified" BOOLEAN,
    "status" "ValidationStatus" NOT NULL DEFAULT 'pending',
    "adminNote" TEXT,
    "reviewedBy" UUID REFERENCES "Users"("id") ON DELETE SET NULL,
    "reviewedAt" TIMESTAMPTZ,
    "submittedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────
-- 5. SOCIAL & MATCHMAKING INTERACTIONS
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "Interests" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "senderId" UUID NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
    "receiverId" UUID NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
    "status" "InterestStatus" NOT NULL DEFAULT 'pending',
    "sentVia" VARCHAR(20), -- Plain varchar without enum
    "respondedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "interests_sender_receiver_unique" UNIQUE ("senderId", "receiverId")
);

CREATE TABLE IF NOT EXISTS "Shortlists" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
    "targetId" UUID NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shortlists_user_target_unique" UNIQUE ("userId", "targetId")
);

CREATE TABLE IF NOT EXISTS "HiddenProfiles" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
    "hiddenId" UUID NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "hidden_profiles_user_hidden_unique" UNIQUE ("userId", "hiddenId")
);

CREATE TABLE IF NOT EXISTS "ProfileViews" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "viewerId" UUID NOT NULL REFERENCES "Users"("id") ON DELETE RESTRICT,
    "viewedId" UUID NOT NULL REFERENCES "Users"("id") ON DELETE RESTRICT,
    "viewedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "DailyRecommendations" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
    "recommendedId" UUID NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
    "date" DATE NOT NULL DEFAULT CURRENT_DATE,
    "shown" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "daily_recommendations_user_rec_date_unique" UNIQUE ("userId", "recommendedId", "date")
);

-- ─────────────────────────────────────────────
-- 6. MESSAGING & NOTIFICATIONS
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "Conversations" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user1Id" UUID NOT NULL REFERENCES "Users"("id") ON DELETE RESTRICT,
    "user2Id" UUID NOT NULL REFERENCES "Users"("id") ON DELETE RESTRICT,
    "lastMessage" TEXT,
    "lastMessageAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "conversations_users_unique" UNIQUE ("user1Id", "user2Id")
);

CREATE TABLE IF NOT EXISTS "Messages" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "conversationId" UUID NOT NULL REFERENCES "Conversations"("id") ON DELETE CASCADE,
    "senderId" UUID NOT NULL REFERENCES "Users"("id") ON DELETE RESTRICT,
    "content" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMPTZ,
    "deletedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Notifications" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────
-- 7. SYSTEM & AUDIT LOGS
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "AppVersions" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "versionCode" INTEGER NOT NULL,
    "versionName" VARCHAR(20) NOT NULL,
    "apkUrl" TEXT NOT NULL,
    "releaseNotes" TEXT,
    "isForceUpdate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "AdminAuditLog" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "adminId" UUID NOT NULL REFERENCES "Users"("id") ON DELETE RESTRICT,
    "action" VARCHAR(100) NOT NULL,
    "targetId" UUID,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "idx_users_email" ON "Users"("email");
CREATE INDEX IF NOT EXISTS "idx_users_mobile" ON "Users"("mobile");
CREATE INDEX IF NOT EXISTS "idx_users_accountStatus" ON "Users"("accountStatus");
CREATE INDEX IF NOT EXISTS "idx_users_role" ON "Users"("role");

CREATE INDEX IF NOT EXISTS "idx_profiles_userId" ON "Profiles"("userId");
CREATE INDEX IF NOT EXISTS "idx_profiles_profileUid" ON "Profiles"("profileUid");
CREATE INDEX IF NOT EXISTS "idx_profiles_completion" ON "Profiles"("profileCompletePct");

CREATE INDEX IF NOT EXISTS "idx_profilePersonal_dob" ON "ProfilePersonal"("dateOfBirth");
CREATE INDEX IF NOT EXISTS "idx_profilePersonal_maritalStatus" ON "ProfilePersonal"("maritalStatus");
CREATE INDEX IF NOT EXISTS "idx_profilePersonal_height" ON "ProfilePersonal"("heightCm");

CREATE INDEX IF NOT EXISTS "idx_profileReligious_caste_subcaste" ON "ProfileReligious"("religion", "caste", "subcaste");
CREATE INDEX IF NOT EXISTS "idx_profileLocations_geo" ON "ProfileLocations"("country", "state", "city");
CREATE INDEX IF NOT EXISTS "idx_profileProfessional_career" ON "ProfileProfessional"("employmentType", "education", "occupation");

CREATE INDEX IF NOT EXISTS "idx_profilePhotos_userId" ON "ProfilePhotos"("userId");
CREATE INDEX IF NOT EXISTS "idx_profilePhotos_validationStatus" ON "ProfilePhotos"("validationStatus");
CREATE INDEX IF NOT EXISTS "idx_profilePhotos_primary" ON "ProfilePhotos"("userId", "isPrimary") WHERE "isPrimary" = true;

CREATE INDEX IF NOT EXISTS "idx_idVerifications_userId" ON "IdVerifications"("userId");
CREATE INDEX IF NOT EXISTS "idx_idVerifications_status" ON "IdVerifications"("status");

CREATE INDEX IF NOT EXISTS "idx_interests_receiver_status" ON "Interests"("receiverId", "status");
CREATE INDEX IF NOT EXISTS "idx_interests_sender_status" ON "Interests"("senderId", "status");
CREATE INDEX IF NOT EXISTS "idx_shortlists_userId" ON "Shortlists"("userId");
CREATE INDEX IF NOT EXISTS "idx_shortlists_targetId" ON "Shortlists"("targetId");
CREATE INDEX IF NOT EXISTS "idx_hiddenProfiles_userId" ON "HiddenProfiles"("userId");

CREATE INDEX IF NOT EXISTS "idx_conversations_user1" ON "Conversations"("user1Id");
CREATE INDEX IF NOT EXISTS "idx_conversations_user2" ON "Conversations"("user2Id");
CREATE INDEX IF NOT EXISTS "idx_messages_conversation_created" ON "Messages"("conversationId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_messages_unread" ON "Messages"("conversationId", "isRead") WHERE "isRead" = false;

-- Partial index for high-frequency unread notifications
CREATE INDEX IF NOT EXISTS "idx_notifications_user_unread" ON "Notifications"("userId", "isRead") WHERE "isRead" = false;
CREATE INDEX IF NOT EXISTS "idx_notifications_user_created" ON "Notifications"("userId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "idx_dailyRecommendations_user_date" ON "DailyRecommendations"("userId", "date");
CREATE INDEX IF NOT EXISTS "idx_profileViews_viewed_viewer" ON "ProfileViews"("viewedId", "viewerId");
CREATE INDEX IF NOT EXISTS "idx_adminAuditLog_adminId" ON "AdminAuditLog"("adminId");
CREATE INDEX IF NOT EXISTS "idx_adminAuditLog_targetId" ON "AdminAuditLog"("targetId");
