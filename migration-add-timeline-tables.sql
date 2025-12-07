-- Migration: Add timeline tables for relationship timeline feature
-- Run this in Supabase SQL Editor

-- Step 1: Create timeline_items table
CREATE TABLE IF NOT EXISTS timeline_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('note', 'task', 'email', 'file', 'meeting')),
  title TEXT NOT NULL,
  body TEXT,
  direction TEXT CHECK (direction IN ('inbound', 'outbound')),
  status TEXT CHECK (status IN ('open', 'done')),
  external_source TEXT,
  external_id TEXT,
  happened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 2: Create indexes for timeline_items
CREATE INDEX IF NOT EXISTS idx_timeline_items_organisation_id ON timeline_items(organisation_id, happened_at DESC);
CREATE INDEX IF NOT EXISTS idx_timeline_items_contact_id ON timeline_items(contact_id, happened_at DESC);
CREATE INDEX IF NOT EXISTS idx_timeline_items_project_id ON timeline_items(project_id, happened_at DESC);
CREATE INDEX IF NOT EXISTS idx_timeline_items_type ON timeline_items(type);
CREATE INDEX IF NOT EXISTS idx_timeline_items_external ON timeline_items(external_source, external_id) WHERE external_source IS NOT NULL;

-- Step 3: Create timeline_attachments table
CREATE TABLE IF NOT EXISTS timeline_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timeline_item_id UUID NOT NULL REFERENCES timeline_items(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  mime_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 4: Create index for timeline_attachments
CREATE INDEX IF NOT EXISTS idx_timeline_attachments_item_id ON timeline_attachments(timeline_item_id);

-- Step 5: Create gmail_credentials table (internal-only)
CREATE TABLE IF NOT EXISTS gmail_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expiry_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 6: Create trigger to update updated_at on gmail_credentials
CREATE OR REPLACE FUNCTION update_gmail_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_gmail_credentials_updated_at ON gmail_credentials;
CREATE TRIGGER trigger_update_gmail_credentials_updated_at
  BEFORE UPDATE ON gmail_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_gmail_credentials_updated_at();

-- Step 7: Enable Row Level Security
ALTER TABLE timeline_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeline_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE gmail_credentials ENABLE ROW LEVEL SECURITY;

-- Step 8: Create RLS policies (allow all operations for now)
DROP POLICY IF EXISTS "Allow all operations on timeline_items" ON timeline_items;
CREATE POLICY "Allow all operations on timeline_items" ON timeline_items FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations on timeline_attachments" ON timeline_attachments;
CREATE POLICY "Allow all operations on timeline_attachments" ON timeline_attachments FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations on gmail_credentials" ON gmail_credentials;
CREATE POLICY "Allow all operations on gmail_credentials" ON gmail_credentials FOR ALL USING (true);

