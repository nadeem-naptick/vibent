CREATE TYPE "public"."task_status" AS ENUM('queued', 'running', 'complete', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"room_id" text NOT NULL,
	"intent_id" text,
	"instruction" text NOT NULL,
	"status" "task_status" DEFAULT 'queued' NOT NULL,
	"summary" text,
	"model" text,
	"events" jsonb DEFAULT '[]'::jsonb,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;