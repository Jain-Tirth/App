-- AlterTable
ALTER TABLE "users"
ADD COLUMN "otp_request_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "otp_window_started_at" TIMESTAMP(3),
ADD COLUMN "refresh_token_hash" TEXT,
ADD COLUMN "refresh_token_expires_at" TIMESTAMP(3);
