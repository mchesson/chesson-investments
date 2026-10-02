CREATE SEQUENCE "public"."project_number" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1001 CACHE 1;--> statement-breakpoint
ALTER TABLE "budget_versions" ADD COLUMN "company_id" uuid;--> statement-breakpoint
ALTER TABLE "budget_versions" ADD COLUMN "person_id" uuid;--> statement-breakpoint
ALTER TABLE "budget_versions" ADD COLUMN "submitted_on" date;--> statement-breakpoint
ALTER TABLE "budget_versions" ADD COLUMN "contract_type" text;--> statement-breakpoint
ALTER TABLE "budget_versions" ADD COLUMN "fee_pct" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "budget_versions" ADD COLUMN "valid_until" date;--> statement-breakpoint
ALTER TABLE "budget_versions" ADD COLUMN "status" text;--> statement-breakpoint
ALTER TABLE "budget_versions" ADD COLUMN "decided_by" uuid;--> statement-breakpoint
ALTER TABLE "budget_versions" ADD COLUMN "decided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "budget_versions" ADD COLUMN "decided_reason" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "project_number" integer DEFAULT nextval('project_number');--> statement-breakpoint
ALTER TABLE "budget_versions" ADD CONSTRAINT "budget_versions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_versions" ADD CONSTRAINT "budget_versions_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_versions" ADD CONSTRAINT "budget_versions_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
UPDATE "projects" p SET "project_number" = n.num FROM (SELECT id, 1000 + row_number() OVER (ORDER BY created_at, id) AS num FROM "projects") n WHERE p.id = n.id;--> statement-breakpoint
SELECT setval('project_number', GREATEST(1001, (SELECT coalesce(max("project_number"), 1000) + 1 FROM "projects")), false);--> statement-breakpoint
CREATE UNIQUE INDEX "projects_number" ON "projects" USING btree ("project_number");