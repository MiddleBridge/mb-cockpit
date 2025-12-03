-- Migration: Make organisations status nullable
-- This allows new organisations to be created without a status (showing as gray "+ Status" button)

-- Remove NOT NULL constraint and default value
ALTER TABLE organisations
ALTER COLUMN status DROP NOT NULL;

ALTER TABLE organisations
ALTER COLUMN status DROP DEFAULT;

-- Update existing organisations that have 'ongoing' to keep them, but allow NULL for new ones
-- (No need to change existing data, just allow NULL for new entries)


