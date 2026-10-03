-- Custom SQL migration file, put your code below! ---- 613 S Ocean Blvd Unit N3: 936 finished sf, from its insurance declaration (Amwins / Vave policy; built 1980, 3rd floor).
WITH fixed AS (
  UPDATE "projects" SET "heated_sf" = 936
  WHERE "name" = '613 S Ocean Blvd Unit N3' AND "heated_sf" IS NULL
  RETURNING "id"
)
INSERT INTO "audit_log" ("entity", "entity_id", "action", "via", "summary", "before", "after")
SELECT 'project', "id", 'update', 'insurance declaration', 'set the heated sf to 936 from the unit''s insurance declaration (built 1980, 3rd floor)',
  '{"heatedSf": null}'::jsonb, '{"heatedSf": 936}'::jsonb
FROM fixed;
