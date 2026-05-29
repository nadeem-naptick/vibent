CREATE TYPE "public"."room_capture_state" AS ENUM('listening', 'paused');--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "capture_state" "room_capture_state" DEFAULT 'listening' NOT NULL;