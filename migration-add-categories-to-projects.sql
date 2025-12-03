-- Migration: Add categories column to projects table if it doesn't exist
-- Run this in Supabase SQL Editor

-- Add categories column if it doesn't exist
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS categories TEXT[] DEFAULT '{}';



