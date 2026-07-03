-- CreateEnum
CREATE TYPE "Role" AS ENUM ('user', 'admin');

-- CreateEnum
CREATE TYPE "MembershipType" AS ENUM ('regular', 'prime');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('pending', 'active', 'rejected', 'blocked');

-- CreateEnum
CREATE TYPE "ProfileCreatedBy" AS ENUM ('myself', 'son', 'daughter', 'brother', 'sister', 'friend', 'relative');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('male', 'female');

-- CreateEnum
CREATE TYPE "BodyType" AS ENUM ('normal', 'athletic', 'heavy', 'slim');

-- CreateEnum
CREATE TYPE "PhysicalStatus" AS ENUM ('normal', 'physically_challenged');

-- CreateEnum
CREATE TYPE "MaritalStatus" AS ENUM ('never_married', 'widower', 'awaiting_divorce', 'divorced');

-- CreateEnum
CREATE TYPE "EatingHabits" AS ENUM ('vegetarian', 'non_vegetarian', 'eggetarian');

-- CreateEnum
CREATE TYPE "ResidentStatus" AS ENUM ('citizen', 'student_visa', 'work_visa', 'pr');

-- CreateEnum
CREATE TYPE "Dosh" AS ENUM ('no', 'yes', 'dont_know');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('private', 'business', 'defence', 'government_psu', 'not_working', 'self_employed');

-- CreateEnum
CREATE TYPE "FamilyStatus" AS ENUM ('middle_class', 'upper_middle_class', 'rich_affluent');

-- CreateEnum
CREATE TYPE "ValidationStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('aadhaar', 'pan', 'driving_licence', 'voter_id', 'other');

-- CreateEnum
CREATE TYPE "InterestStatus" AS ENUM ('pending', 'accepted', 'declined');

-- CreateEnum
CREATE TYPE "InterestSentVia" AS ENUM ('button', 'swipe');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('interest_received', 'interest_accepted', 'profile_approved', 'new_message', 'profile_viewed');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "mobile" VARCHAR(15) NOT NULL,
    "mobile_verified" BOOLEAN NOT NULL DEFAULT false,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "role" "Role" NOT NULL DEFAULT 'user',
    "membership_type" "MembershipType" NOT NULL DEFAULT 'regular',
    "account_status" "AccountStatus" NOT NULL DEFAULT 'pending',
    "rejection_reason" TEXT,
    "profile_created_by" "ProfileCreatedBy",
    "gender" "Gender",
    "last_seen" TIMESTAMP(3),
    "otp_code" VARCHAR(6),
    "otp_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "profile_uid" VARCHAR(15),
    "date_of_birth" DATE NOT NULL,
    "height_cm" INTEGER,
    "weight_kg" INTEGER,
    "body_type" "BodyType",
    "physical_status" "PhysicalStatus",
    "marital_status" "MaritalStatus",
    "spoken_languages" TEXT[],
    "eating_habits" "EatingHabits",
    "resident_status" "ResidentStatus",
    "religion" VARCHAR(50),
    "caste" VARCHAR(100),
    "subcaste" VARCHAR(100),
    "open_to_any_subcaste" BOOLEAN NOT NULL DEFAULT false,
    "gothra" VARCHAR(100),
    "dosh" "Dosh",
    "manglik" "Dosh",
    "country" VARCHAR(100),
    "state" VARCHAR(100),
    "city" VARCHAR(100),
    "education" VARCHAR(150),
    "employment_type" "EmploymentType",
    "occupation" VARCHAR(150),
    "income_currency" VARCHAR(10) DEFAULT 'INR',
    "annual_income_range" VARCHAR(50),
    "family_status" "FamilyStatus",
    "about_myself" TEXT,
    "looking_for" TEXT,
    "cuisine" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hobbies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "music" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "smoking_habits" VARCHAR(30),
    "drinking_habits" VARCHAR(30),
    "movies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "books" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "birth_time" TIME,
    "birth_place_country" VARCHAR(100),
    "star" VARCHAR(50),
    "raasi" VARCHAR(50),
    "kundli_score" INTEGER,
    "horoscope_file_url" TEXT,
    "photo_verified" BOOLEAN NOT NULL DEFAULT false,
    "id_verified" BOOLEAN NOT NULL DEFAULT false,
    "profile_complete" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_preferences" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "pref_age_min" INTEGER,
    "pref_age_max" INTEGER,
    "pref_height_min_cm" INTEGER,
    "pref_height_max_cm" INTEGER,
    "pref_marital_status" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pref_mother_tongue" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pref_physical_status" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pref_eating_habits" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pref_smoking_habits" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pref_drinking_habits" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pref_religion" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pref_caste" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pref_subcaste" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "open_to_any_caste" BOOLEAN NOT NULL DEFAULT false,
    "pref_country" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pref_state" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pref_city" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pref_citizenship" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pref_education" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pref_employment_type" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pref_occupation" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pref_income_min" INTEGER,
    "pref_income_max" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_photos" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "file_url" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "validation_status" "ValidationStatus" NOT NULL DEFAULT 'pending',
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "id_verifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "document_type" "DocumentType" NOT NULL,
    "document_number" TEXT,
    "front_image_url" TEXT,
    "back_image_url" TEXT,
    "selfie_url" TEXT,
    "ocr_name" TEXT,
    "ocr_dob" DATE,
    "ocr_confidence" DOUBLE PRECISION,
    "face_match_score" DOUBLE PRECISION,
    "age_verified" BOOLEAN,
    "status" "ValidationStatus" NOT NULL DEFAULT 'pending',
    "admin_note" TEXT,
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "id_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interests" (
    "id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "receiver_id" UUID NOT NULL,
    "status" "InterestStatus" NOT NULL DEFAULT 'pending',
    "sent_via" "InterestSentVia",
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shortlists" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "target_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shortlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hidden_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "hidden_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hidden_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "user1_id" UUID NOT NULL,
    "user2_id" UUID NOT NULL,
    "last_message" TEXT,
    "last_message_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_recommendations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "recommended_id" UUID NOT NULL,
    "date" DATE NOT NULL DEFAULT CURRENT_DATE,
    "shown" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_views" (
    "id" UUID NOT NULL,
    "viewer_id" UUID NOT NULL,
    "viewed_id" UUID NOT NULL,
    "viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_versions" (
    "id" UUID NOT NULL,
    "version_code" INTEGER NOT NULL,
    "version_name" VARCHAR(20) NOT NULL,
    "apk_url" TEXT NOT NULL,
    "release_notes" TEXT,
    "is_force_update" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_log" (
    "id" UUID NOT NULL,
    "admin_id" UUID NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "target_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_mobile_key" ON "users"("mobile");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_user_id_key" ON "profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_profile_uid_key" ON "profiles"("profile_uid");

-- CreateIndex
CREATE INDEX "profiles_user_id_idx" ON "profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "partner_preferences_user_id_key" ON "partner_preferences"("user_id");

-- CreateIndex
CREATE INDEX "profile_photos_user_id_idx" ON "profile_photos"("user_id");

-- CreateIndex
CREATE INDEX "id_verifications_user_id_idx" ON "id_verifications"("user_id");

-- CreateIndex
CREATE INDEX "id_verifications_status_idx" ON "id_verifications"("status");

-- CreateIndex
CREATE INDEX "interests_receiver_id_idx" ON "interests"("receiver_id");

-- CreateIndex
CREATE INDEX "interests_status_idx" ON "interests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "interests_sender_id_receiver_id_key" ON "interests"("sender_id", "receiver_id");

-- CreateIndex
CREATE INDEX "shortlists_user_id_idx" ON "shortlists"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "shortlists_user_id_target_id_key" ON "shortlists"("user_id", "target_id");

-- CreateIndex
CREATE INDEX "hidden_profiles_user_id_idx" ON "hidden_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "hidden_profiles_user_id_hidden_id_key" ON "hidden_profiles"("user_id", "hidden_id");

-- CreateIndex
CREATE INDEX "conversations_user1_id_idx" ON "conversations"("user1_id");

-- CreateIndex
CREATE INDEX "conversations_user2_id_idx" ON "conversations"("user2_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_user1_id_user2_id_key" ON "conversations"("user1_id", "user2_id");

-- CreateIndex
CREATE INDEX "messages_conversation_id_idx" ON "messages"("conversation_id");

-- CreateIndex
CREATE INDEX "messages_sender_id_idx" ON "messages"("sender_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_is_read_idx" ON "notifications"("is_read");

-- CreateIndex
CREATE INDEX "daily_recommendations_user_id_date_idx" ON "daily_recommendations"("user_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_recommendations_user_id_recommended_id_date_key" ON "daily_recommendations"("user_id", "recommended_id", "date");

-- CreateIndex
CREATE INDEX "profile_views_viewed_id_idx" ON "profile_views"("viewed_id");

-- CreateIndex
CREATE INDEX "profile_views_viewer_id_idx" ON "profile_views"("viewer_id");

-- CreateIndex
CREATE INDEX "admin_audit_log_admin_id_idx" ON "admin_audit_log"("admin_id");

-- CreateIndex
CREATE INDEX "admin_audit_log_target_id_idx" ON "admin_audit_log"("target_id");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_preferences" ADD CONSTRAINT "partner_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_photos" ADD CONSTRAINT "profile_photos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "id_verifications" ADD CONSTRAINT "id_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "id_verifications" ADD CONSTRAINT "id_verifications_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interests" ADD CONSTRAINT "interests_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interests" ADD CONSTRAINT "interests_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shortlists" ADD CONSTRAINT "shortlists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shortlists" ADD CONSTRAINT "shortlists_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hidden_profiles" ADD CONSTRAINT "hidden_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hidden_profiles" ADD CONSTRAINT "hidden_profiles_hidden_id_fkey" FOREIGN KEY ("hidden_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user1_id_fkey" FOREIGN KEY ("user1_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user2_id_fkey" FOREIGN KEY ("user2_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_recommendations" ADD CONSTRAINT "daily_recommendations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_recommendations" ADD CONSTRAINT "daily_recommendations_recommended_id_fkey" FOREIGN KEY ("recommended_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_views" ADD CONSTRAINT "profile_views_viewer_id_fkey" FOREIGN KEY ("viewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_views" ADD CONSTRAINT "profile_views_viewed_id_fkey" FOREIGN KEY ("viewed_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
