CREATE TABLE "site_lead_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"text" text NOT NULL,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "site_lead_notes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "site_leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"topic" text,
	"message" text,
	"property_address" text,
	"property_city" text,
	"property_kind" text,
	"condition" text,
	"timeline" text,
	"asking_price" text,
	"referrer" text,
	"landing_page" text,
	"form_page" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"ip_hash" text,
	"handled_by" uuid,
	"status_changed_at" timestamp with time zone,
	"person_id" uuid,
	"property_id" uuid,
	"alert_sent" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "site_leads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "site_page_views" (
	"day" date NOT NULL,
	"path" text NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "site_page_views_day_path_pk" PRIMARY KEY("day","path")
);
--> statement-breakpoint
ALTER TABLE "site_page_views" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "site_lead_notes" ADD CONSTRAINT "site_lead_notes_lead_id_site_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."site_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_lead_notes" ADD CONSTRAINT "site_lead_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_leads" ADD CONSTRAINT "site_leads_handled_by_users_id_fk" FOREIGN KEY ("handled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_leads" ADD CONSTRAINT "site_leads_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_leads" ADD CONSTRAINT "site_leads_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "site_lead_notes_lead" ON "site_lead_notes" USING btree ("lead_id","created_at");--> statement-breakpoint
CREATE INDEX "site_leads_status" ON "site_leads" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "site_leads_ip" ON "site_leads" USING btree ("ip_hash","created_at");