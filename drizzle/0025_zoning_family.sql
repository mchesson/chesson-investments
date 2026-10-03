ALTER TABLE "projects" ADD COLUMN "zoning_family" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "zoning_place" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "zoning_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "zoning_family" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "zoning_place" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "zoning_checked_at" timestamp with time zone;