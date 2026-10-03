ALTER TABLE "projects" ADD COLUMN "actual_sale_costs" numeric(14, 2);--> statement-breakpoint
-- 2211 Hillock Dr: the $18,685 from its settlement statement is the whole cost
-- of selling (commissions included). It was counted again with 5% commissions,
-- which understated the profit by $21,500 (owner, Oct 3, 2026).
WITH fixed AS (
  UPDATE "projects" SET "actual_sale_costs" = "closing_cost_at_sale"
  WHERE "name" = '2211 Hillock Dr' AND "actual_sale_price" IS NOT NULL AND "closing_cost_at_sale" IS NOT NULL AND "actual_sale_costs" IS NULL
  RETURNING "id", "closing_cost_at_sale"
)
INSERT INTO "audit_log" ("entity", "entity_id", "action", "via", "summary", "before", "after")
SELECT 'project', "id", 'update', 'sale cost fix',
  'set the actual cost of sale to the settlement statement''s total, so the commissions aren''t counted twice',
  '{"actualSaleCosts": null}'::jsonb, jsonb_build_object('actualSaleCosts', "closing_cost_at_sale")
FROM fixed;
--> statement-breakpoint
-- 2211 Hillock Dr's heated area from Wake County's parcel record (PIN 0796703922): 2,258 sf.
WITH fixed AS (
  UPDATE "projects" SET "heated_sf" = 2258
  WHERE "name" = '2211 Hillock Dr' AND "heated_sf" IS NULL
  RETURNING "id"
)
INSERT INTO "audit_log" ("entity", "entity_id", "action", "via", "summary", "before", "after")
SELECT 'project', "id", 'update', 'Wake County parcel record', 'set the heated sf to 2,258 from Wake County''s parcel record (PIN 0796703922)',
  '{"heatedSf": null}'::jsonb, '{"heatedSf": 2258}'::jsonb
FROM fixed;
