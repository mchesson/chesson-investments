-- Owner, Oct 3, 2026: "380 was not the lot cost on plainview it was 310 read the purchase
-- agreements the rest was closing then tear down then holding". The lot is $310,000; the
-- other $70,000 of the old all-in figure waits for the closing statement, the tear-down
-- invoice and the holding costs to be entered as their own lines.
UPDATE "projects" SET "lot_cost" = 310000,
  "notes" = 'Lot $310,000 per the purchase agreement. The earlier $380,000 was the all-in cost to date: the other $70,000 is closing, tear-down and holding, to be entered as their own lines (closing statement, demolition invoice, holding costs). ' || coalesce("notes", ''),
  "updated_at" = now()
WHERE "id" = '91428d0d-9c84-4a4d-b257-83f843d05175' AND "lot_cost" = 380000;
--> statement-breakpoint
INSERT INTO "audit_log" ("entity", "entity_id", "action", "via", "summary", "before", "after")
SELECT 'project', '91428d0d-9c84-4a4d-b257-83f843d05175', 'update', 'owner correction',
  'set the lot cost to $310,000 per the purchase agreement (was $380,000, which included closing, tear-down and holding)', '{"lotCost": 380000}', '{"lotCost": 310000}'
WHERE EXISTS (SELECT 1 FROM "projects" WHERE "id" = '91428d0d-9c84-4a4d-b257-83f843d05175' AND "lot_cost" = 310000)
  AND NOT EXISTS (SELECT 1 FROM "audit_log" WHERE "entity_id" = '91428d0d-9c84-4a4d-b257-83f843d05175' AND "via" = 'owner correction' AND "summary" LIKE 'set the lot cost to $310,000%');
--> statement-breakpoint
-- The Grey #101: 1,576 heated sf, Stanley Martin's Tessa plan (the owner's property sheet).
UPDATE "projects" SET "heated_sf" = 1576, "plan" = coalesce("plan", 'Tessa (Stanley Martin Homes)'), "updated_at" = now()
WHERE "id" = 'eaefdac3-ff98-41e7-a497-9a43017a4b6d' AND "heated_sf" IS NULL;
--> statement-breakpoint
INSERT INTO "audit_log" ("entity", "entity_id", "action", "via", "summary", "after")
SELECT 'project', 'eaefdac3-ff98-41e7-a497-9a43017a4b6d', 'update', 'property sheet',
  'set the heated square feet to 1,576 and the plan to Tessa (Stanley Martin Homes), from the owner''s property sheet', '{"heatedSf": 1576}'
WHERE EXISTS (SELECT 1 FROM "projects" WHERE "id" = 'eaefdac3-ff98-41e7-a497-9a43017a4b6d' AND "heated_sf" = 1576)
  AND NOT EXISTS (SELECT 1 FROM "audit_log" WHERE "entity_id" = 'eaefdac3-ff98-41e7-a497-9a43017a4b6d' AND "via" = 'property sheet');
--> statement-breakpoint
-- 1823 Rankin St presold at $1,660,000 (109 Plainview's notes): a presale, watched until it closes.
UPDATE "comps" SET "status" = 'presale', "notes" = 'Presold at $1,660,000 (109 Plainview notes). ' || coalesce("notes", ''), "updated_at" = now()
WHERE "project_id" = '91428d0d-9c84-4a4d-b257-83f843d05175' AND "address" = '1823 Rankin St' AND "status" = 'appraised';
--> statement-breakpoint
INSERT INTO "audit_log" ("entity", "entity_id", "action", "via", "summary")
SELECT 'project', '91428d0d-9c84-4a4d-b257-83f843d05175', 'comp-update', 'owner correction', 'marked the comp 1823 Rankin St a presale at $1,660,000 (watched until it closes)'
WHERE EXISTS (SELECT 1 FROM "comps" WHERE "project_id" = '91428d0d-9c84-4a4d-b257-83f843d05175' AND "address" = '1823 Rankin St' AND "status" = 'presale')
  AND NOT EXISTS (SELECT 1 FROM "audit_log" WHERE "entity_id" = '91428d0d-9c84-4a4d-b257-83f843d05175' AND "summary" LIKE 'marked the comp 1823 Rankin St a presale%');
