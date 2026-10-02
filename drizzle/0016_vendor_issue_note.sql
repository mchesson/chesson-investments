ALTER TABLE "vendor_issues" ADD COLUMN "vendor_note" text;--> statement-breakpoint
ALTER TABLE "vendor_issues" ADD COLUMN "vendor_note_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vendor_issues" ADD COLUMN "vendor_note_by" uuid;--> statement-breakpoint
ALTER TABLE "vendor_issues" ADD CONSTRAINT "vendor_issues_vendor_note_by_users_id_fk" FOREIGN KEY ("vendor_note_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;