-- Migration: Add avatar column to contacts table
-- Run this in Supabase SQL Editor if you have existing data

ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS avatar TEXT;

