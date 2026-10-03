-- Drop Documents takes files up to 50 MB (settlement packets and receipt scans
-- run 5-23 MB); the private bucket allowed 5 MB. Supabase only: skipped where
-- there's no storage schema (local and CI databases).
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    UPDATE storage.buckets SET file_size_limit = 52428800 WHERE id = 'files' AND coalesce(file_size_limit, 0) < 52428800;
  END IF;
END $$;
