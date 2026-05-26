ALTER TABLE "rooms" ALTER COLUMN "objective" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "rooms" ALTER COLUMN "output_type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "instructions" text;