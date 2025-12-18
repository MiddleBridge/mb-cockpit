-- Add full_text and summary columns to documents table
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS full_text TEXT,
  ADD COLUMN IF NOT EXISTS summary TEXT;

-- Add index for full-text search (optional, but recommended)
CREATE INDEX IF NOT EXISTS idx_documents_full_text ON documents USING gin(to_tsvector('english', full_text));
CREATE INDEX IF NOT EXISTS idx_documents_summary ON documents USING gin(to_tsvector('english', summary));

 