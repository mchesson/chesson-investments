CREATE TABLE "market_parcels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"county" text NOT NULL,
	"parcel_key" text NOT NULL,
	"address" text,
	"street" text,
	"city" text,
	"zip" text,
	"neighborhood" text,
	"land_use" text,
	"heated_sf" integer,
	"year_built" integer,
	"acres" numeric(10, 3),
	"assessed_value" numeric(14, 2),
	"owner_name" text,
	"absentee" boolean,
	"lat" numeric(9, 6),
	"lng" numeric(9, 6),
	"last_sale_price" numeric(14, 2),
	"last_sale_on" date,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "market_parcels" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "market_sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parcel_id" uuid NOT NULL,
	"sold_on" date NOT NULL,
	"price" numeric(14, 2) NOT NULL,
	"heated_sf" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "market_sales" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "market_syncs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"county" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"since" date NOT NULL,
	"offset" integer DEFAULT 0 NOT NULL,
	"total" integer,
	"parcels" integer DEFAULT 0 NOT NULL,
	"new_sales" integer DEFAULT 0 NOT NULL,
	"error" text,
	"started_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "market_syncs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "lat" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "lng" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "lat" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "lng" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "market_sales" ADD CONSTRAINT "market_sales_parcel_id_market_parcels_id_fk" FOREIGN KEY ("parcel_id") REFERENCES "public"."market_parcels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_syncs" ADD CONSTRAINT "market_syncs_started_by_users_id_fk" FOREIGN KEY ("started_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "market_parcels_key" ON "market_parcels" USING btree ("county","parcel_key");--> statement-breakpoint
CREATE INDEX "market_parcels_sale" ON "market_parcels" USING btree ("last_sale_on");--> statement-breakpoint
CREATE INDEX "market_parcels_latlng" ON "market_parcels" USING btree ("lat","lng");--> statement-breakpoint
CREATE INDEX "market_parcels_hood" ON "market_parcels" USING btree ("neighborhood");--> statement-breakpoint
CREATE INDEX "market_parcels_street" ON "market_parcels" USING btree ("street","city");--> statement-breakpoint
CREATE UNIQUE INDEX "market_sales_once" ON "market_sales" USING btree ("parcel_id","sold_on","price");--> statement-breakpoint
CREATE INDEX "market_sales_on" ON "market_sales" USING btree ("sold_on");--> statement-breakpoint
CREATE INDEX "market_syncs_county" ON "market_syncs" USING btree ("county","created_at");