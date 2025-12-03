-- Migration: Add notes_updated_at column to contacts table
-- Run this in Supabase SQL Editor

-- Add notes_updated_at column to contacts table
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS notes_updated_at TIMESTAMP WITH TIME ZONE;

-- Update existing contacts that have notes to set notes_updated_at to updated_at or created_at
UPDATE contacts 
SET notes_updated_at = COALESCE(updated_at, created_at)
WHERE notes IS NOT NULL AND notes != '' AND notes_updated_at IS NULL;


