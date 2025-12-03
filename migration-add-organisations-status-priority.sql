-- Migration: Add status and priority columns to organisations table
-- This allows better organization and filtering of organisations

-- Add status column
ALTER TABLE organisations
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ongoing' 
CHECK (status IN ('ongoing', 'freezed', 'lost', 'active_but_ceased'));

-- Add priority column
ALTER TABLE organisations
ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'mid' 
CHECK (priority IN ('low', 'mid', 'prio', 'high prio'));

-- Update existing organisations to have default values (if any exist)
UPDATE organisations 
SET status = 'ongoing' 
WHERE status IS NULL;

UPDATE organisations 
SET priority = 'mid' 
WHERE priority IS NULL;

