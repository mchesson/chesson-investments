CREATE TABLE "market_econ" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"series" text NOT NULL,
	"period" date NOT NULL,
	"value" numeric(16, 4) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "market_econ" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "market_econ_once" ON "market_econ" USING btree ("series","period");