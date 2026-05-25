CREATE TABLE "versions" (
	"id" text PRIMARY KEY NOT NULL,
	"room_id" text NOT NULL,
	"version_number" integer NOT NULL,
	"task_id" text,
	"rolled_back_from_version_id" text,
	"summary" text NOT NULL,
	"snapshot_path" text NOT NULL,
	"file_count" integer DEFAULT 0 NOT NULL,
	"total_bytes" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "versions" ADD CONSTRAINT "versions_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;