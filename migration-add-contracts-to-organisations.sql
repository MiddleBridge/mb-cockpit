-- Migration: Add contracts, comments and terms tables for organisations
-- This enables contract management, PDF parsing and structured terms tracking

-- 1. Create organisation_documents table
CREATE TABLE IF NOT EXISTS organisation_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  parsed_text TEXT,
  analysis_guide TEXT
);

-- 2. Create organisation_contract_comments table
CREATE TABLE IF NOT EXISTS organisation_contract_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  document_id UUID REFERENCES organisation_documents(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  author TEXT,
  comment_text TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high'))
);

-- 3. Create organisation_contract_terms table
CREATE TABLE IF NOT EXISTS organisation_contract_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  document_id UUID REFERENCES organisation_documents(id) ON DELETE SET NULL,
  term_key TEXT NOT NULL,
  term_label TEXT NOT NULL,
  term_value TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  renewal_type TEXT CHECK (renewal_type IN ('none', 'fixed', 'auto')),
  renewal_date DATE,
  billing_cycle TEXT CHECK (billing_cycle IN ('monthly', 'quarterly', 'yearly')),
  importance TEXT DEFAULT 'medium' CHECK (importance IN ('low', 'medium', 'high')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Create trigger to update updated_at automatically
CREATE OR REPLACE FUNCTION update_organisation_contract_terms_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS organisation_contract_terms_updated_at ON organisation_contract_terms;
CREATE TRIGGER organisation_contract_terms_updated_at
  BEFORE UPDATE ON organisation_contract_terms
  FOR EACH ROW
  EXECUTE FUNCTION update_organisation_contract_terms_updated_at();

-- 5. Enable RLS
ALTER TABLE organisation_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE organisation_contract_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE organisation_contract_terms ENABLE ROW LEVEL SECURITY;

-- 6. Create policies (allow all for now, adjust based on your auth setup)
DROP POLICY IF EXISTS "Allow all operations on organisation_documents" ON organisation_documents;
CREATE POLICY "Allow all operations on organisation_documents" ON organisation_documents FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations on organisation_contract_comments" ON organisation_contract_comments;
CREATE POLICY "Allow all operations on organisation_contract_comments" ON organisation_contract_comments FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations on organisation_contract_terms" ON organisation_contract_terms;
CREATE POLICY "Allow all operations on organisation_contract_terms" ON organisation_contract_terms FOR ALL USING (true);

-- 7. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_organisation_documents_organisation_id ON organisation_documents(organisation_id);
CREATE INDEX IF NOT EXISTS idx_organisation_contract_comments_organisation_id ON organisation_contract_comments(organisation_id);
CREATE INDEX IF NOT EXISTS idx_organisation_contract_terms_organisation_id ON organisation_contract_terms(organisation_id);
CREATE INDEX IF NOT EXISTS idx_organisation_contract_terms_is_active ON organisation_contract_terms(is_active);


