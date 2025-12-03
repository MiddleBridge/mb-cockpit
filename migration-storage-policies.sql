-- RLS Policies for mb-cockpit storage bucket
-- Run this in Supabase SQL Editor

-- First, make sure the bucket exists and is public
-- (Do this manually in Dashboard: Storage → mb-cockpit → Settings → Public bucket: ON)

-- Policy 1: Allow anyone to read files (SELECT)
-- Drop if exists first (might have been created before)
DROP POLICY IF EXISTS "Allow public read access" ON storage.objects;
CREATE POLICY "Allow public read access"
ON storage.objects FOR SELECT
USING (bucket_id = 'mb-cockpit');

-- Policy 2: Allow anyone to upload files (INSERT)
DROP POLICY IF EXISTS "Allow public upload" ON storage.objects;
CREATE POLICY "Allow public upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'mb-cockpit');

-- Policy 3: Allow anyone to update files (UPDATE)
DROP POLICY IF EXISTS "Allow public update" ON storage.objects;
CREATE POLICY "Allow public update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'mb-cockpit')
WITH CHECK (bucket_id = 'mb-cockpit');

-- Policy 4: Allow anyone to delete files (DELETE)
DROP POLICY IF EXISTS "Allow public delete" ON storage.objects;
CREATE POLICY "Allow public delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'mb-cockpit');

