CREATE TABLE "trips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_on" date NOT NULL,
	"vehicle_id" uuid,
	"entity_id" uuid,
	"kind" text DEFAULT 'site_visit' NOT NULL,
	"purpose" text NOT NULL,
	"project_id" uuid,
	"property_id" uuid,
	"place" text,
	"stops" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"miles" numeric(8, 1) NOT NULL,
	"miles_how" text DEFAULT 'typed' NOT NULL,
	"start_odometer" integer,
	"end_odometer" integer,
	"round_trip" boolean DEFAULT true NOT NULL,
	"lat" numeric(9, 6),
	"lng" numeric(9, 6),
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "trips" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "vehicle_odometers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"start_miles" integer,
	"end_miles" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vehicle_odometers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"entity_id" uuid,
	"placed_in_service" date,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "vehicles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "overhead_expenses" ADD COLUMN "vehicle_id" uuid;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_odometers" ADD CONSTRAINT "vehicle_odometers_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trips_on" ON "trips" USING btree ("trip_on");--> statement-breakpoint
CREATE INDEX "trips_project" ON "trips" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_odometers_year" ON "vehicle_odometers" USING btree ("vehicle_id","year");