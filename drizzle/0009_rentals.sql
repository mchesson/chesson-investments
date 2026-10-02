CREATE TABLE "leases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"tenants" text NOT NULL,
	"rent" numeric(14, 2) NOT NULL,
	"due_day" integer,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"renewal_terms" text,
	"decide_by" date,
	"deposit" numeric(14, 2),
	"deposit_held_by" text,
	"deposit_returned" numeric(14, 2),
	"pets" text,
	"utilities_paid_by" text,
	"terms" text,
	"status" text DEFAULT 'active' NOT NULL,
	"ended_on" date,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "loans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"lender_company_id" uuid,
	"lender_name" text,
	"original_amount" numeric(14, 2),
	"balance" numeric(14, 2),
	"balance_on" date,
	"rate_pct" numeric(6, 3),
	"monthly_payment" numeric(14, 2),
	"escrow_included" boolean DEFAULT false NOT NULL,
	"started_on" date,
	"matures_on" date,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "loans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "rent_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"lease_id" uuid,
	"received_on" date NOT NULL,
	"for_month" date,
	"kind" text DEFAULT 'rent' NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "rent_receipts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "rentals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"status" text DEFAULT 'getting_ready' NOT NULL,
	"asking_rent" numeric(14, 2),
	"listed_on" date,
	"listed_where" text,
	"manager_company_id" uuid,
	"manager_person_id" uuid,
	"management_fee_pct" numeric(5, 2),
	"leasing_fee" numeric(14, 2),
	"management_terms" text,
	"taxes_monthly" numeric(14, 2),
	"insurance_monthly" numeric(14, 2),
	"hoa_monthly" numeric(14, 2),
	"utilities_monthly" numeric(14, 2),
	"repairs_reserve_pct" numeric(5, 2),
	"vacancy_pct" numeric(5, 2),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rentals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_lender_company_id_companies_id_fk" FOREIGN KEY ("lender_company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rent_receipts" ADD CONSTRAINT "rent_receipts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rent_receipts" ADD CONSTRAINT "rent_receipts_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rent_receipts" ADD CONSTRAINT "rent_receipts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_manager_company_id_companies_id_fk" FOREIGN KEY ("manager_company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_manager_person_id_people_id_fk" FOREIGN KEY ("manager_person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "leases_project" ON "leases" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "loans_project" ON "loans" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "rent_receipts_project" ON "rent_receipts" USING btree ("project_id","received_on");--> statement-breakpoint
CREATE UNIQUE INDEX "rentals_project" ON "rentals" USING btree ("project_id");