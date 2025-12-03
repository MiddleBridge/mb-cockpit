-- Migration: Add website column to contacts table
-- Run this in Supabase SQL Editor

ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS website TEXT;



