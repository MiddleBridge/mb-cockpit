-- Migration: Ensure projects table exists with all required columns
-- Run this in Supabase SQL Editor
-- This will create the table if it doesn't exist, or add missing columns if it does

-- Step 1: Create projects table if it doesn't exist
CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'ongoing' CHECK (status IN ('ongoing', 'done', 'failed', 'on-hold')),
  priority TEXT NOT NULL DEFAULT 'mid' CHECK (priority IN ('low', 'mid', 'prio', 'high prio')),
  organisation_id UUID,
  categories TEXT[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Step 2: Add missing columns if table already exists but is missing some columns
DO $$
BEGIN
  -- Add name column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'name'
  ) THEN
    ALTER TABLE projects ADD COLUMN name TEXT NOT NULL DEFAULT '';
  END IF;

  -- Add description column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'description'
  ) THEN
    ALTER TABLE projects ADD COLUMN description TEXT;
  END IF;

  -- Add status column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'status'
  ) THEN
    ALTER TABLE projects ADD COLUMN status TEXT NOT NULL DEFAULT 'ongoing';
    -- Add check constraint if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'projects_status_check' AND table_name = 'projects'
    ) THEN
      ALTER TABLE projects ADD CONSTRAINT projects_status_check 
      CHECK (status IN ('ongoing', 'done', 'failed', 'on-hold'));
    END IF;
  END IF;

  -- Add priority column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'priority'
  ) THEN
    ALTER TABLE projects ADD COLUMN priority TEXT NOT NULL DEFAULT 'mid';
    -- Add check constraint if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'projects_priority_check' AND table_name = 'projects'
    ) THEN
      ALTER TABLE projects ADD CONSTRAINT projects_priority_check 
      CHECK (priority IN ('low', 'mid', 'prio', 'high prio'));
    END IF;
  END IF;

  -- Add organisation_id column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'organisation_id'
  ) THEN
    ALTER TABLE projects ADD COLUMN organisation_id UUID;
  END IF;

  -- Add categories column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'categories'
  ) THEN
    ALTER TABLE projects ADD COLUMN categories TEXT[] DEFAULT '{}';
  END IF;

  -- Add notes column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'notes'
  ) THEN
    ALTER TABLE projects ADD COLUMN notes TEXT;
  END IF;

  -- Add created_at column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE projects ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW());
  END IF;

  -- Add updated_at column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE projects ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW());
  END IF;
END $$;

-- Step 3: Add foreign key constraint if organisations table exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'organisations') THEN
    -- Check if foreign key doesn't already exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'projects_organisation_id_fkey' 
      AND table_name = 'projects'
    ) THEN
      ALTER TABLE projects 
      ADD CONSTRAINT projects_organisation_id_fkey 
      FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- Step 4: Enable Row Level Security (RLS)
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Step 5: Create or replace RLS policy
DROP POLICY IF EXISTS "Allow all operations on projects" ON projects;
-- Drop if exists first (might have been created by previous migrations)
DROP POLICY IF EXISTS "Allow all operations on projects" ON projects;
CREATE POLICY "Allow all operations on projects" ON projects FOR ALL USING (true);

-- Step 6: Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_projects_organisation_id ON projects(organisation_id);



