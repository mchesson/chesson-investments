ALTER TABLE "projects" ADD COLUMN "purchased_on" date;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "completed_on" date;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "original_estimate" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "target_profit_pct" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "planned_exit" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "backup_exit" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "actual_exit" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "review_notes" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "review_updated_at" timestamp with time zone;