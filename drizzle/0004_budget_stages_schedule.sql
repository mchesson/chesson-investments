CREATE TABLE "assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"cost_code_id" uuid,
	"description" text NOT NULL,
	"responsible" text NOT NULL,
	"person_id" uuid,
	"company_id" uuid,
	"user_id" uuid,
	"gc_allowance" numeric(14, 2),
	"our_cost" numeric(14, 2),
	"milestone_id" uuid,
	"offset_days" integer,
	"due_on" date,
	"status" text DEFAULT 'open' NOT NULL,
	"done_on" date,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "budget_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"label" text,
	"prepared_by" text,
	"lines" jsonb NOT NULL,
	"total_cents" integer NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "budget_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"planned_start" date,
	"planned_end" date,
	"actual_start" date,
	"actual_end" date,
	"source" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "milestones" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_cost_code_id_cost_codes_id_fk" FOREIGN KEY ("cost_code_id") REFERENCES "public"."cost_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_milestone_id_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_versions" ADD CONSTRAINT "budget_versions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_versions" ADD CONSTRAINT "budget_versions_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_versions" ADD CONSTRAINT "budget_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assignments_project" ON "assignments" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "budget_versions_project" ON "budget_versions" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "milestones_project" ON "milestones" USING btree ("project_id","sort");