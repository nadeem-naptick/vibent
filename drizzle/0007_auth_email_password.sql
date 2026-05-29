CREATE TYPE "public"."verification_token_type" AS ENUM('email_verification', 'password_reset');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "verificationTokens" ADD COLUMN "type" "verification_token_type" DEFAULT 'email_verification' NOT NULL;