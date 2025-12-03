-- Migration: Change organization to organizations array and add projects array to contacts table
-- Run this in Supabase SQL Editor

-- Step 1: Add new columns
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS organizations TEXT[] DEFAULT '{}';

ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS projects TEXT[] DEFAULT '{}';

-- Step 2: Migrate existing organization data to organizations array
UPDATE contacts 
SET organizations = ARRAY[organization]::TEXT[]
WHERE organization IS NOT NULL AND organization != '';

-- Step 3: Set organizations to empty array for contacts without organization
UPDATE contacts 
SET organizations = '{}'
WHERE organizations IS NULL;

-- Note: We keep the old 'organization' column for backward compatibility
-- You can drop it later if needed:
-- ALTER TABLE contacts DROP COLUMN IF EXISTS organization;




