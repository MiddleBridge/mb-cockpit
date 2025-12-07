-- Migration: Add more fields to organisations table (website, location, sector, notes, avatar)
-- This makes organisations more feature-rich, similar to contacts

-- Add website column
ALTER TABLE organisations
ADD COLUMN IF NOT EXISTS website TEXT;

-- Add location column
ALTER TABLE organisations
ADD COLUMN IF NOT EXISTS location TEXT;

-- Add sector column
ALTER TABLE organisations
ADD COLUMN IF NOT EXISTS sector TEXT;

-- Add notes column
ALTER TABLE organisations
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add notes_updated_at column
ALTER TABLE organisations
ADD COLUMN IF NOT EXISTS notes_updated_at TIMESTAMP WITH TIME ZONE;

-- Add avatar column
ALTER TABLE organisations
ADD COLUMN IF NOT EXISTS avatar TEXT;


