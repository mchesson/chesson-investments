CREATE TABLE "comps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"property_id" uuid,
	"source" text NOT NULL,
	"status" text DEFAULT 'sold' NOT NULL,
	"address" text NOT NULL,
	"city" text,
	"neighborhood" text,
	"sold_on" date,
	"price" numeric(14, 2),
	"heated_sf" integer,
	"beds" numeric(4, 1),
	"baths" numeric(4, 1),
	"year_built" integer,
	"lot_acres" numeric(8, 3),
	"finish_level" text,
	"quality" text,
	"distance_mi" numeric(6, 2),
	"adjustments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"adjusted_price" numeric(14, 2),
	"counted" boolean DEFAULT true NOT NULL,
	"checked" boolean DEFAULT true NOT NULL,
	"notes" text,
	"file_id" uuid,
	"market_sale_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "comps" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "finish_level" text;--> statement-breakpoint
ALTER TABLE "comps" ADD CONSTRAINT "comps_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comps" ADD CONSTRAINT "comps_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comps" ADD CONSTRAINT "comps_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comps" ADD CONSTRAINT "comps_market_sale_id_market_sales_id_fk" FOREIGN KEY ("market_sale_id") REFERENCES "public"."market_sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comps" ADD CONSTRAINT "comps_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comps_project" ON "comps" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "comps_property" ON "comps" USING btree ("property_id");