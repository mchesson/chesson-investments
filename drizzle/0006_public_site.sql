ALTER TABLE "files" ADD COLUMN "photo_kind" text;--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "on_site" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "sort" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "source_url" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "site_status" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "site_slug" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "site_price" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "site_tagline" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "site_description" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "site_beds" numeric(4, 1);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "site_baths" numeric(4, 1);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "site_details" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "site_team" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "site_featured" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "site_sort" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "site_updated_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "projects_site_slug" ON "projects" USING btree ("site_slug");