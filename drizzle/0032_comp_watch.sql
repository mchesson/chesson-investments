ALTER TABLE "comps" ADD COLUMN "expected_close_on" date;--> statement-breakpoint
ALTER TABLE "comps" ADD COLUMN "actual_price" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "comps" ADD COLUMN "actual_sold_on" date;--> statement-breakpoint
ALTER TABLE "comps" ADD COLUMN "close_found_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "comps" ADD COLUMN "provided_by_person_id" uuid;--> statement-breakpoint
ALTER TABLE "comps" ADD COLUMN "provided_by_company_id" uuid;--> statement-breakpoint
ALTER TABLE "comps" ADD COLUMN "builder_name" text;--> statement-breakpoint
ALTER TABLE "comps" ADD COLUMN "custom_build" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "comps" ADD CONSTRAINT "comps_provided_by_person_id_people_id_fk" FOREIGN KEY ("provided_by_person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comps" ADD CONSTRAINT "comps_provided_by_company_id_companies_id_fk" FOREIGN KEY ("provided_by_company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;