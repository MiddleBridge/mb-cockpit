-- Migration: Update organisations status values
-- Changes status from: active, inactive, prospect, partner
-- To: ongoing, freezed, lost, active_but_ceased

-- First, drop the old constraint
ALTER TABLE organisations
DROP CONSTRAINT IF EXISTS organisations_status_check;

-- Map old status values to new ones
-- You may want to adjust these mappings based on your business logic
UPDATE organisations
SET status = CASE 
  WHEN status = 'active' THEN 'ongoing'
  WHEN status = 'inactive' THEN 'freezed'
  WHEN status = 'prospect' THEN 'ongoing'
  WHEN status = 'partner' THEN 'ongoing'
  ELSE 'ongoing'
END
WHERE status IN ('active', 'inactive', 'prospect', 'partner');

-- Add the new constraint with new status values
-- Drop if exists first (might have been created before)
ALTER TABLE organisations
DROP CONSTRAINT IF EXISTS organisations_status_check;
ALTER TABLE organisations
ADD CONSTRAINT organisations_status_check 
CHECK (status IN ('ongoing', 'freezed', 'lost', 'active_but_ceased'));

-- Update default value
ALTER TABLE organisations
ALTER COLUMN status SET DEFAULT 'ongoing';



