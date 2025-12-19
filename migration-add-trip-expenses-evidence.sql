-- Migration: Add trip expenses and evidence tracking to finance_transactions
-- Run this in Supabase SQL Editor

-- Step 1: Add new fields to finance_transactions table
ALTER TABLE finance_transactions 
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS paid_by_company_card BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS exclude_from_reimbursement BOOLEAN NOT NULL DEFAULT false;

-- Step 2: Create index for project_id for faster filtering
CREATE INDEX IF NOT EXISTS idx_finance_transactions_project_id 
  ON finance_transactions(project_id);

-- Step 3: Create evidence table
CREATE TABLE IF NOT EXISTS evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  file_size BIGINT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 4: Create evidence_links table (polymorphic links)
CREATE TABLE IF NOT EXISTS evidence_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_id UUID NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL CHECK (link_type IN ('transaction', 'note', 'project')),
  link_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(evidence_id, link_type, link_id)
);

-- Step 5: Create indexes for evidence table
CREATE INDEX IF NOT EXISTS idx_evidence_org_id ON evidence(org_id);
CREATE INDEX IF NOT EXISTS idx_evidence_project_id ON evidence(project_id);
CREATE INDEX IF NOT EXISTS idx_evidence_created_at ON evidence(created_at DESC);

-- Step 6: Create indexes for evidence_links table
CREATE INDEX IF NOT EXISTS idx_evidence_links_evidence_id ON evidence_links(evidence_id);
CREATE INDEX IF NOT EXISTS idx_evidence_links_link ON evidence_links(link_type, link_id);

-- Step 7: Enable Row Level Security (RLS)
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_links ENABLE ROW LEVEL SECURITY;

-- Step 8: Create RLS policies for evidence table
DROP POLICY IF EXISTS "Allow all operations on evidence" ON evidence;
CREATE POLICY "Allow all operations on evidence" 
  ON evidence FOR ALL USING (true);

-- Step 9: Create RLS policies for evidence_links table
DROP POLICY IF EXISTS "Allow all operations on evidence_links" ON evidence_links;
CREATE POLICY "Allow all operations on evidence_links" 
  ON evidence_links FOR ALL USING (true);

