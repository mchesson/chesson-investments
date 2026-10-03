ALTER TABLE "rentals" ADD COLUMN "kind" text DEFAULT 'long_term' NOT NULL;--> statement-breakpoint
-- The beach condo is a short-term rental (Hospitable, booking sites): its own row, operating.
INSERT INTO "rentals" ("project_id", "kind", "status")
SELECT 'bda61d1f-1d6f-4f46-8fe4-896ceb65df33', 'short_term', 'operating'
WHERE EXISTS (SELECT 1 FROM "projects" WHERE "id" = 'bda61d1f-1d6f-4f46-8fe4-896ceb65df33')
ON CONFLICT ("project_id") DO UPDATE SET "kind" = 'short_term', "status" = CASE WHEN "rentals"."status" IN ('getting_ready','listed','operating','paused') THEN "rentals"."status" ELSE 'operating' END, "updated_at" = now();
--> statement-breakpoint
INSERT INTO "audit_log" ("entity", "entity_id", "action", "via", "summary", "after")
SELECT 'project', 'bda61d1f-1d6f-4f46-8fe4-896ceb65df33', 'rental-update', 'owner correction', 'marked it a short-term rental (Operating, booking guests)', '{"kind": "short_term", "status": "operating"}'
WHERE EXISTS (SELECT 1 FROM "projects" WHERE "id" = 'bda61d1f-1d6f-4f46-8fe4-896ceb65df33')
  AND NOT EXISTS (SELECT 1 FROM "audit_log" WHERE "entity_id" = 'bda61d1f-1d6f-4f46-8fe4-896ceb65df33' AND "summary" LIKE 'marked it a short-term rental%');
