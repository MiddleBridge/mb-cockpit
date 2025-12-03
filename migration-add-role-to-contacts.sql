-- Migration: Add role column to contacts table and create roles table
-- Run this in Supabase SQL Editor

-- Step 1: Create roles table (similar to categories)
CREATE TABLE IF NOT EXISTS roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Step 2: Insert default roles
INSERT INTO roles (name)
SELECT 'CEO'
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'CEO');

INSERT INTO roles (name)
SELECT 'Chairman'
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'Chairman');

INSERT INTO roles (name)
SELECT 'CTO'
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'CTO');

INSERT INTO roles (name)
SELECT 'CFO'
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'CFO');

INSERT INTO roles (name)
SELECT 'COO'
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'COO');

INSERT INTO roles (name)
SELECT 'Analyst'
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'Analyst');

INSERT INTO roles (name)
SELECT 'Manager'
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'Manager');

INSERT INTO roles (name)
SELECT 'Director'
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'Director');

INSERT INTO roles (name)
SELECT 'VP'
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'VP');

INSERT INTO roles (name)
SELECT 'President'
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'President');

-- Step 3: Add role column to contacts table
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS role TEXT;

-- Step 4: Enable Row Level Security for roles table
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- Step 5: Create policy for roles table
-- Drop if exists first (might have been created before)
DROP POLICY IF EXISTS "Allow all operations on roles" ON roles;
CREATE POLICY "Allow all operations on roles" ON roles FOR ALL USING (true);



