-- Migration: Add support for multiple organisations per project
-- Changes organisation_id (single UUID) to organisation_ids (UUID array)
-- Run this in Supabase SQL Editor

-- Step 1: Add organisation_ids column as UUID array
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS organisation_ids UUID[] DEFAULT '{}';

-- Step 2: Migrate existing data from organisation_id to organisation_ids
-- Convert single organisation_id to array format
UPDATE projects
SET organisation_ids = ARRAY[organisation_id]::UUID[]
WHERE organisation_id IS NOT NULL 
  AND (organisation_ids IS NULL OR organisation_ids = '{}');

-- Step 3: Drop the foreign key constraint on organisation_id if it exists
-- (We'll keep the column for backward compatibility but remove the constraint)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'projects_organisation_id_fkey' 
    AND table_name = 'projects'
  ) THEN
    ALTER TABLE projects 
    DROP CONSTRAINT projects_organisation_id_fkey;
  END IF;
END $$;

-- Step 4: Create index for faster queries on organisation_ids
CREATE INDEX IF NOT EXISTS idx_projects_organisation_ids ON projects USING GIN (organisation_ids);

-- Note: The old organisation_id column is kept for backward compatibility
-- but new projects should use organisation_ids array instead

