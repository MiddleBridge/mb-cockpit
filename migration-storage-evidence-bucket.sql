-- Migration: Create evidence storage bucket and policies
-- Run this in Supabase SQL Editor

-- Note: Buckets must be created manually in Supabase Dashboard → Storage
-- This script only creates the RLS policies

-- Enable Row Level Security on storage.objects
-- (This is usually already enabled, but included for completeness)

-- Create RLS policies for evidence bucket (private bucket with signed URLs)
-- Users can only access files from their organization

-- Policy for SELECT (reading files - via signed URLs only, but we need this for RLS)
CREATE POLICY IF NOT EXISTS "Allow org members to view evidence files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'evidence' AND
  -- Extract org_id from path: org/{orgId}/...
  (storage.foldername(name))[1] = 'org' AND
  -- Check if user has access (adjust based on your auth setup)
  -- For now, allow all - adjust based on your authentication system
  true
);

-- Policy for INSERT (uploading files)
CREATE POLICY IF NOT EXISTS "Allow org members to upload evidence files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'evidence' AND
  -- Extract org_id from path: org/{orgId}/...
  (storage.foldername(name))[1] = 'org' AND
  -- Check if user has access (adjust based on your auth setup)
  -- For now, allow all - adjust based on your authentication system
  true
);

-- Policy for UPDATE (updating files)
CREATE POLICY IF NOT EXISTS "Allow org members to update evidence files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'evidence' AND
  (storage.foldername(name))[1] = 'org' AND
  true
)
WITH CHECK (
  bucket_id = 'evidence' AND
  (storage.foldername(name))[1] = 'org' AND
  true
);

-- Policy for DELETE (deleting files)
CREATE POLICY IF NOT EXISTS "Allow org members to delete evidence files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'evidence' AND
  (storage.foldername(name))[1] = 'org' AND
  true
);

-- Note: To create the bucket manually:
-- 1. Go to Supabase Dashboard → Storage
-- 2. Click "New bucket"
-- 3. Name: "evidence"
-- 4. Make it PRIVATE (do not make it public - we use signed URLs)
-- 5. Click "Create bucket"

