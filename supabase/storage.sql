-- ============================================================
-- NeuroGlove Supabase Storage Configuration
-- 
-- Apply AFTER schema.sql and rls_policies.sql
-- 
-- IMPORTANT: Original PADS dataset files must NOT be publicly
-- redistributed per CC BY-NC-SA 4.0 licence.
-- Use private bucket with signed URLs only.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'neuroglove-research',
  'neuroglove-research',
  false,         -- PRIVATE bucket — no public access
  52428800,      -- 50 MB max per file
  ARRAY[
    'application/json',
    'text/csv',
    'text/plain',
    'application/octet-stream'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can list and read files
DROP POLICY IF EXISTS "Authenticated users can read research files" ON storage.objects;
CREATE POLICY "Authenticated users can read research files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'neuroglove-research');

-- Only service role can upload / update / delete
DROP POLICY IF EXISTS "Service role can upload research files" ON storage.objects;
CREATE POLICY "Service role can upload research files"
  ON storage.objects FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'neuroglove-research');

DROP POLICY IF EXISTS "Service role can update research files" ON storage.objects;
CREATE POLICY "Service role can update research files"
  ON storage.objects FOR UPDATE
  TO service_role
  USING (bucket_id = 'neuroglove-research');

DROP POLICY IF EXISTS "Service role can delete research files" ON storage.objects;
CREATE POLICY "Service role can delete research files"
  ON storage.objects FOR DELETE
  TO service_role
  USING (bucket_id = 'neuroglove-research');
