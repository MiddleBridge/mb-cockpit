# Migration Instructions: Remove Duplicates and Add Unique Constraint

## Problem
You have duplicate contacts in your database (same name + organization), which prevents adding a unique constraint.

## Solution
Run the migration script to remove duplicates first, then add the constraint.

## Steps

### 1. Run the migration script in Supabase SQL Editor

Go to your Supabase Dashboard → SQL Editor and run:

```sql
-- Step 1: Remove duplicate contacts (keep the most recent one)
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

-- Step 3: Add the unique constraint
ALTER TABLE contacts 
ADD CONSTRAINT unique_contact_in_org UNIQUE (name, organization);
```

### 2. Verify

After running the migration, verify that duplicates are gone:

```sql
-- Check for remaining duplicates
SELECT name, organization, COUNT(*) 
FROM contacts 
GROUP BY name, organization 
HAVING COUNT(*) > 1;
```

This should return no rows.

### 3. Test

Try adding a duplicate contact - you should now get a proper error message instead of a database error.




