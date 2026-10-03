ALTER TABLE "properties" ADD COLUMN "source_company_id" uuid;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "source_kind" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "source_accurate" boolean;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "source_note" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "deal_type" text DEFAULT 'lot' NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "lots_possible" integer;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "utilities" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "entitlement" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "commercial_use" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "checklist" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_source_company_id_companies_id_fk" FOREIGN KEY ("source_company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "properties_source_company" ON "properties" USING btree ("source_company_id");