-- 1. Create the bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'invoices',
  'invoices',
  true,
  52428800, -- 50MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- 2. Enable row-level security (RLS) policies for storage.objects
-- Allow public access to view/download files in the 'invoices' bucket
DROP POLICY IF EXISTS "Allow public read access to invoices" ON storage.objects;
CREATE POLICY "Allow public read access to invoices"
ON storage.objects FOR SELECT
USING (bucket_id = 'invoices');

-- Allow anyone to upload new files into the 'invoices' bucket
DROP POLICY IF EXISTS "Allow public uploads to invoices" ON storage.objects;
CREATE POLICY "Allow public uploads to invoices"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'invoices');

-- Allow updates and deletes
DROP POLICY IF EXISTS "Allow public updates to invoices" ON storage.objects;
CREATE POLICY "Allow public updates to invoices"
ON storage.objects FOR UPDATE
USING (bucket_id = 'invoices')
WITH CHECK (bucket_id = 'invoices');

DROP POLICY IF EXISTS "Allow public deletes to invoices" ON storage.objects;
CREATE POLICY "Allow public deletes to invoices"
ON storage.objects FOR DELETE
USING (bucket_id = 'invoices');
