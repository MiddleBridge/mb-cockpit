-- Migration: Create storage bucket and policies for trip evidence
-- Run this in Supabase SQL Editor
-- Note: Bucket must be created manually in Supabase Dashboard → Storage
-- This script only creates the RLS policies

-- Storage policies for trip-evidence bucket (private bucket with signed URLs)
-- Using the same pattern as other storage buckets in the project

-- Drop existing policies if they exist (to allow re-running this script)
DROP POLICY IF EXISTS "Allow all operations on trip-evidence files" ON storage.objects;
DROP POLICY IF EXISTS "Allow all operations on trip-evidence files insert" ON storage.objects;
DROP POLICY IF EXISTS "Allow all operations on trip-evidence files update" ON storage.objects;
DROP POLICY IF EXISTS "Allow all operations on trip-evidence files delete" ON storage.objects;

-- Policy for SELECT (reading files - via signed URLs only, but we need this for RLS)
CREATE POLICY "Allow all operations on trip-evidence files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'trip-evidence'
);

-- Policy for INSERT (uploading files)
CREATE POLICY "Allow all operations on trip-evidence files insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'trip-evidence'
);

-- Policy for UPDATE (updating files)
CREATE POLICY "Allow all operations on trip-evidence files update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'trip-evidence'
)
WITH CHECK (
  bucket_id = 'trip-evidence'
);

-- Policy for DELETE (deleting files)
CREATE POLICY "Allow all operations on trip-evidence files delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'trip-evidence'
);

-- Note: To create the bucket manually:
-- 1. Go to Supabase Dashboard → Storage
-- 2. Click "New bucket"
-- 3. Name: "trip-evidence"
-- 4. Make it PRIVATE (do not make it public - we use signed URLs)
-- 5. Click "Create bucket"

