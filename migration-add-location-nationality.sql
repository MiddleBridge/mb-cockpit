-- Migration: Add location and nationality columns to contacts table
-- Run this in Supabase SQL Editor

-- Add location column to contacts table
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS location TEXT;

-- Add nationality column to contacts table
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS nationality TEXT;




