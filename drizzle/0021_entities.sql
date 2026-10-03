CREATE TABLE "entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'llc' NOT NULL,
	"state" text,
	"formed_on" date,
	"status" text DEFAULT 'active' NOT NULL,
	"tax_form" text,
	"fiscal_year_end" text,
	"address" text,
	"registered_agent" text,
	"website" text,
	"company_id" uuid,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "entities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "entity_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"name" text NOT NULL,
	"person_id" uuid,
	"member_entity_id" uuid,
	"percent" numeric(7, 4),
	"capital" numeric(14, 2),
	"role" text,
	"since" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "entity_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "entity_tax_ids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"label" text,
	"cipher" text NOT NULL,
	"last4" text NOT NULL,
	"issued_on" date,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "entity_tax_ids" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "entities" ADD CONSTRAINT "entities_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entities" ADD CONSTRAINT "entities_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_members" ADD CONSTRAINT "entity_members_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_members" ADD CONSTRAINT "entity_members_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_members" ADD CONSTRAINT "entity_members_member_entity_id_entities_id_fk" FOREIGN KEY ("member_entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_tax_ids" ADD CONSTRAINT "entity_tax_ids_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_tax_ids" ADD CONSTRAINT "entity_tax_ids_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entities_company" ON "entities" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "entity_members_entity" ON "entity_members" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "entity_members_person" ON "entity_members" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "entity_members_member_entity" ON "entity_members" USING btree ("member_entity_id");--> statement-breakpoint
CREATE INDEX "entity_tax_ids_entity" ON "entity_tax_ids" USING btree ("entity_id");