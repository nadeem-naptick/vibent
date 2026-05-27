CREATE TABLE "shares" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"room_id" text NOT NULL,
	"version_id" text,
	"created_by" text NOT NULL,
	"s3_prefix" text NOT NULL,
	"file_count" integer NOT NULL,
	"total_bytes" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "shares_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "shares" ADD CONSTRAINT "shares_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shares" ADD CONSTRAINT "shares_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;