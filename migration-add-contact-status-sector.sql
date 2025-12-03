-- Migration: Add contact_status and sector columns to contacts table
-- Run this in Supabase SQL Editor

-- Add contact_status column (ongoing, freezed)
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS contact_status TEXT CHECK (contact_status IN ('ongoing', 'freezed'));

-- Add sector column
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS sector TEXT;




