-- Create projects table
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

-- Add organisation_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'organisation_id'
  ) THEN
    ALTER TABLE projects ADD COLUMN organisation_id UUID;
  END IF;
END $$;

-- Add foreign key constraint if organisations table exists
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

-- Enable Row Level Security (RLS)
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Create policy (allow all operations for now)
-- Drop if exists first (might have been created by migration-add-project-type.sql)
DROP POLICY IF EXISTS "Allow all operations on projects" ON projects;
CREATE POLICY "Allow all operations on projects" ON projects FOR ALL USING (true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_projects_organisation_id ON projects(organisation_id);

