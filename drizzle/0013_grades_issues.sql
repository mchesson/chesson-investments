CREATE SEQUENCE "public"."issue_number" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 101 CACHE 1;--> statement-breakpoint
CREATE TABLE "grades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid,
	"person_id" uuid,
	"project_id" uuid,
	"grade" text NOT NULL,
	"quality" text,
	"schedule" text,
	"budget" text,
	"communication" text,
	"justification" text NOT NULL,
	"graded_by" uuid,
	"graded_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "grades" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "issue_people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issue_id" uuid NOT NULL,
	"person_id" uuid,
	"user_id" uuid,
	"role" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "issue_people" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "vendor_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" integer DEFAULT nextval('issue_number'),
	"company_id" uuid,
	"person_id" uuid,
	"project_id" uuid,
	"title" text NOT NULL,
	"details" text,
	"severity" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"reported_on" date NOT NULL,
	"due_on" date,
	"resolved_on" date,
	"resolution" text,
	"cost_to_fix" numeric(14, 2),
	"reported_by" uuid,
	"status_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "vendor_issues" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "grade_override" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "grade_override_reason" text;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "grade_override" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "grade_override_reason" text;--> statement-breakpoint
ALTER TABLE "grades" ADD CONSTRAINT "grades_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grades" ADD CONSTRAINT "grades_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grades" ADD CONSTRAINT "grades_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grades" ADD CONSTRAINT "grades_graded_by_users_id_fk" FOREIGN KEY ("graded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_people" ADD CONSTRAINT "issue_people_issue_id_vendor_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."vendor_issues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_people" ADD CONSTRAINT "issue_people_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_people" ADD CONSTRAINT "issue_people_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_issues" ADD CONSTRAINT "vendor_issues_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_issues" ADD CONSTRAINT "vendor_issues_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_issues" ADD CONSTRAINT "vendor_issues_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_issues" ADD CONSTRAINT "vendor_issues_reported_by_users_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "grades_company" ON "grades" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "grades_person" ON "grades" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "grades_project" ON "grades" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "issue_people_issue" ON "issue_people" USING btree ("issue_id");--> statement-breakpoint
CREATE INDEX "issue_people_person" ON "issue_people" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "vendor_issues_company" ON "vendor_issues" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "vendor_issues_person" ON "vendor_issues" USING btree ("person_id","status");--> statement-breakpoint
CREATE INDEX "vendor_issues_project" ON "vendor_issues" USING btree ("project_id");