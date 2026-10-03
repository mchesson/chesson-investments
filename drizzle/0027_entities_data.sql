-- Chesson Investments LLC and WJ Investment Group LLC from their formation
-- documents and operating agreements (owner, Oct 3, 2026: "I gave you all the
-- docs"). Tax IDs are not here: the owner types them in the Tax IDs tab.
-- Only adds what isn't there yet; History says where each came from.
INSERT INTO "entities" ("name", "kind", "state", "formed_on", "status", "tax_form", "fiscal_year_end", "address", "registered_agent", "notes")
SELECT 'Chesson Investments LLC', 'llc', 'NC', '2024-11-05', 'active', NULL, '12/31', '4120 Fawn Lily Drive, Wake Forest, NC 27587', 'Matthew Chesson',
  'NC Secretary of State SOSID 2942923, filed Nov 5, 2024. Operating agreement effective Nov 5, 2024: Matthew Chesson sole member and manager.'
WHERE NOT EXISTS (SELECT 1 FROM "entities" WHERE lower("name") LIKE 'chesson investments%' AND "archived_at" IS NULL);
--> statement-breakpoint
INSERT INTO "entities" ("name", "kind", "state", "formed_on", "status", "tax_form", "fiscal_year_end", "address", "registered_agent", "notes")
SELECT 'WJ Investment Group LLC', 'llc', 'NC', '2023-02-22', 'active', '1065 partnership', '12/31', '4120 Fawn Lily Drive, Wake Forest, NC 27587', 'Matthew Boyd Chesson',
  'NC Secretary of State SOSID 2581836, formed Feb 22, 2023. Operating agreement effective May 20, 2025: managers Matthew Chesson and James Bailey.'
WHERE NOT EXISTS (SELECT 1 FROM "entities" WHERE lower("name") LIKE 'wj investment%' AND "archived_at" IS NULL);
--> statement-breakpoint
WITH e AS (SELECT "id" FROM "entities" WHERE "name" = 'Chesson Investments LLC' AND "archived_at" IS NULL LIMIT 1)
INSERT INTO "entity_members" ("entity_id", "name", "person_id", "percent", "capital", "role", "since", "notes")
SELECT e."id", 'Matthew Chesson', (SELECT "id" FROM "people" WHERE lower("first_name") = 'matthew' AND lower("last_name") = 'chesson' AND "archived_at" IS NULL LIMIT 1),
  100, 397000, 'member_manager', '2024-11-05', 'Operating agreement, Schedule I'
FROM e WHERE NOT EXISTS (SELECT 1 FROM "entity_members" m WHERE m."entity_id" = e."id" AND m."removed_at" IS NULL);
--> statement-breakpoint
WITH e AS (SELECT "id" FROM "entities" WHERE "name" = 'WJ Investment Group LLC' AND "archived_at" IS NULL LIMIT 1),
     ci AS (SELECT "id" FROM "entities" WHERE "name" = 'Chesson Investments LLC' AND "archived_at" IS NULL LIMIT 1)
INSERT INTO "entity_members" ("entity_id", "name", "person_id", "member_entity_id", "percent", "capital", "role", "since", "notes")
SELECT e."id", v.name,
  CASE WHEN v.first IS NULL THEN NULL ELSE (SELECT "id" FROM "people" p WHERE lower(p."first_name") = v.first AND lower(p."last_name") = v.last AND p."archived_at" IS NULL LIMIT 1) END,
  CASE WHEN v.is_ci THEN (SELECT "id" FROM ci) ELSE NULL END,
  v.pct, v.capital, v.role, '2025-05-20'::date, 'Operating agreement effective May 20, 2025, Schedule I'
FROM e, (VALUES
  ('Chesson Investments LLC', NULL, NULL, true, 65::numeric, 146250::numeric, 'member'),
  ('James Bailey', 'james', 'bailey', false, 35::numeric, 78750::numeric, 'member_manager'),
  ('Matthew Chesson', 'matthew', 'chesson', false, NULL::numeric, NULL::numeric, 'manager')
) AS v(name, first, last, is_ci, pct, capital, role)
WHERE NOT EXISTS (SELECT 1 FROM "entity_members" m WHERE m."entity_id" = e."id" AND m."removed_at" IS NULL);
--> statement-breakpoint
INSERT INTO "audit_log" ("entity", "entity_id", "action", "via", "summary")
SELECT 'entity', "id", 'create', 'formation documents',
  CASE WHEN "name" LIKE 'WJ%' THEN 'added WJ Investment Group LLC from its articles, certificate of existence and operating agreement: Chesson Investments 65%, James Bailey 35%'
       ELSE 'added Chesson Investments LLC from its articles and operating agreement: Matthew Chesson 100%' END
FROM "entities" e
WHERE "name" IN ('Chesson Investments LLC', 'WJ Investment Group LLC') AND "archived_at" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "audit_log" a WHERE a."entity" = 'entity' AND a."entity_id" = e."id" AND a."via" = 'formation documents');
