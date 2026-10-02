CREATE TABLE "market_permits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"county" text NOT NULL,
	"permit_no" text NOT NULL,
	"kind" text NOT NULL,
	"issued_on" date,
	"year" integer NOT NULL,
	"address" text,
	"city" text,
	"zip" text,
	"lat" numeric(9, 6),
	"lng" numeric(9, 6),
	"cost" numeric(14, 2),
	"sf" integer,
	"units" integer,
	"builder" text,
	"description" text,
	"status" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "market_permits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "market_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"series" text NOT NULL,
	"week" date NOT NULL,
	"rate" numeric(5, 2) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "market_rates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "market_trends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"region_type" text NOT NULL,
	"region" text NOT NULL,
	"metro" text,
	"property_type" text NOT NULL,
	"period_end" date NOT NULL,
	"median_sale_price" numeric(14, 2),
	"median_list_price" numeric(14, 2),
	"median_ppsf" numeric(10, 1),
	"homes_sold" integer,
	"pending_sales" integer,
	"new_listings" integer,
	"inventory" integer,
	"months_of_supply" numeric(6, 1),
	"median_dom" numeric(6, 1),
	"sale_to_list" numeric(6, 4),
	"sold_above_list" numeric(6, 4),
	"price_drops" numeric(6, 4),
	"off_market_2wk" numeric(6, 4)
);
--> statement-breakpoint
ALTER TABLE "market_trends" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "market_permits_key" ON "market_permits" USING btree ("source","permit_no");--> statement-breakpoint
CREATE INDEX "market_permits_latlng" ON "market_permits" USING btree ("lat","lng");--> statement-breakpoint
CREATE INDEX "market_permits_year" ON "market_permits" USING btree ("kind","year");--> statement-breakpoint
CREATE UNIQUE INDEX "market_rates_week" ON "market_rates" USING btree ("series","week");--> statement-breakpoint
CREATE UNIQUE INDEX "market_trends_once" ON "market_trends" USING btree ("region_type","region","property_type","period_end");--> statement-breakpoint
CREATE INDEX "market_trends_period" ON "market_trends" USING btree ("period_end");