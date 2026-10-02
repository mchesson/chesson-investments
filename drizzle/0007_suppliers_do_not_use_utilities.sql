CREATE TABLE "project_utilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"service" text NOT NULL,
	"company_id" uuid,
	"person_id" uuid,
	"started_on" date,
	"ended_on" date,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "project_utilities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "do_not_use" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "do_not_use_reason" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "do_not_use_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "do_not_use_by" uuid;--> statement-breakpoint
ALTER TABLE "party_roles" ADD COLUMN "supplier_types" text[];--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "do_not_use" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "do_not_use_reason" text;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "do_not_use_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "do_not_use_by" uuid;--> statement-breakpoint
ALTER TABLE "project_utilities" ADD CONSTRAINT "project_utilities_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_utilities" ADD CONSTRAINT "project_utilities_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_utilities" ADD CONSTRAINT "project_utilities_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_utilities" ADD CONSTRAINT "project_utilities_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_utilities_project" ON "project_utilities" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_utilities_company" ON "project_utilities" USING btree ("company_id");