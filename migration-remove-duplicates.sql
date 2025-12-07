-- Migration: Remove duplicate contacts before adding unique constraint
-- This script removes duplicate contacts, keeping only the most recent one

-- Step 1: Find and delete duplicate contacts (keep the one with the latest created_at)
-- For contacts with organization
DELETE FROM contacts
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY name, organization 
             ORDER BY created_at DESC
           ) as rn
    FROM contacts
    WHERE organization IS NOT NULL
  ) t
  WHERE t.rn > 1
);

-- Step 2: For contacts without organization (NULL)
DELETE FROM contacts
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY name 
             ORDER BY created_at DESC
           ) as rn
    FROM contacts
    WHERE organization IS NULL
  ) t
  WHERE t.rn > 1
);

-- Step 3: Now add the unique constraint
ALTER TABLE contacts 
ADD CONSTRAINT unique_contact_in_org UNIQUE (name, organization);




