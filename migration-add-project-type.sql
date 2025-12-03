-- Migration: Add project_type column to projects table
-- This separates projects into "MB 2.0" and "Internal" categories
-- Run this in Supabase SQL Editor

-- Step 0: Ensure categories column exists (if projects table was created without it)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'categories'
  ) THEN
    ALTER TABLE projects 
    ADD COLUMN categories TEXT[] DEFAULT '{}';
  END IF;
END $$;

-- Step 1: Add project_type column to projects table
-- Default to 'mb-2.0' for existing projects (all current projects are from MB 2.0)
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS project_type TEXT NOT NULL DEFAULT 'mb-2.0' 
CHECK (project_type IN ('mb-2.0', 'internal'));

-- Update all existing projects to be 'mb-2.0' (since they were added from MB 2.0)
-- Only update projects that don't have project_type set yet (NULL)
-- This should only run once when migrating existing data
UPDATE projects 
SET project_type = 'mb-2.0' 
WHERE project_type IS NULL;

-- Step 2: Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_projects_project_type ON projects(project_type);

-- Step 3: Update RLS policies
-- Drop existing policy
DROP POLICY IF EXISTS "Allow all operations on projects" ON projects;

-- Since the application layer filters projects based on user type (see getProjects() in projects.ts),
-- we can use a simpler RLS policy that allows all operations.
-- The filtering happens in the application code based on isMB20User() function.
-- 
-- If you want to enforce this at the database level, you would need to:
-- 1. Set up proper authentication (Supabase Auth or custom)
-- 2. Store user type in JWT claims or user metadata
-- 3. Update the policies below to check user type from JWT
--
-- For now, we allow all operations and rely on application-level filtering:
CREATE POLICY "Allow all operations on projects" 
ON projects FOR ALL 
USING (true);

-- Alternative: If you want database-level enforcement, uncomment and customize these:
-- 
-- Policy for internal users (can see all projects)
-- CREATE POLICY "Internal users can access all projects" 
-- ON projects FOR ALL 
-- USING (
--   -- Check if user is internal (not MB 2.0)
--   -- Example: (auth.jwt() ->> 'user_type')::text != 'mb-2.0'
--   -- Or: (auth.jwt() ->> 'user_type')::text IS NULL
--   true  -- Replace with actual check
-- );
--
-- Policy for MB 2.0 users (can only see MB 2.0 projects)
-- CREATE POLICY "MB 2.0 users can only access MB 2.0 projects" 
-- ON projects FOR SELECT 
-- USING (
--   project_type = 'mb-2.0'
--   -- AND (auth.jwt() ->> 'user_type')::text = 'mb-2.0'
-- );
--
-- CREATE POLICY "MB 2.0 users can only create MB 2.0 projects" 
-- ON projects FOR INSERT 
-- WITH CHECK (
--   project_type = 'mb-2.0'
--   -- AND (auth.jwt() ->> 'user_type')::text = 'mb-2.0'
-- );
--
-- CREATE POLICY "MB 2.0 users can only update MB 2.0 projects" 
-- ON projects FOR UPDATE 
-- USING (
--   project_type = 'mb-2.0'
--   -- AND (auth.jwt() ->> 'user_type')::text = 'mb-2.0'
-- )
-- WITH CHECK (
--   project_type = 'mb-2.0'
--   -- AND (auth.jwt() ->> 'user_type')::text = 'mb-2.0'
-- );
--
-- CREATE POLICY "MB 2.0 users can only delete MB 2.0 projects" 
-- ON projects FOR DELETE 
-- USING (
--   project_type = 'mb-2.0'
--   -- AND (auth.jwt() ->> 'user_type')::text = 'mb-2.0'
-- );

