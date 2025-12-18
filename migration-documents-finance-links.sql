-- Migration: Documents ↔ Finance Transactions linking
-- This migration adapts the existing documents table and creates document_links junction table
-- Run this in Supabase SQL Editor

-- ============================================================================
-- 1. Adapt existing documents table to new structure
-- ============================================================================

-- Add missing columns to documents table (if they don't exist)
ALTER TABLE documents 
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS doc_type TEXT CHECK (doc_type IN ('INVOICE', 'CONTRACT', 'RECEIPT', 'BANK_CONFIRMATION', 'OTHER')),
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS sha256 TEXT,
  ADD COLUMN IF NOT EXISTS mime_type TEXT,
  ADD COLUMN IF NOT EXISTS file_name TEXT,
  ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_by UUID;

-- Migrate existing data: use 'name' as 'title' if title is null
UPDATE documents 
SET title = name 
WHERE title IS NULL AND name IS NOT NULL;

-- Set default doc_type for existing documents
UPDATE documents 
SET doc_type = 'OTHER' 
WHERE doc_type IS NULL;

-- Migrate file_url to storage_path if storage_path is null
UPDATE documents 
SET storage_path = file_url 
WHERE storage_path IS NULL AND file_url IS NOT NULL;

-- Migrate file_type to mime_type if mime_type is null
UPDATE documents 
SET mime_type = file_type 
WHERE mime_type IS NULL AND file_type IS NOT NULL;

-- Migrate name to file_name if file_name is null
UPDATE documents 
SET file_name = name 
WHERE file_name IS NULL AND name IS NOT NULL;

-- Migrate file_size to file_size_bytes if file_size_bytes is null
UPDATE documents 
SET file_size_bytes = file_size 
WHERE file_size_bytes IS NULL AND file_size IS NOT NULL;

-- Make title NOT NULL (after migration)
ALTER TABLE documents 
  ALTER COLUMN title SET NOT NULL;

-- Make doc_type NOT NULL (after setting defaults)
ALTER TABLE documents 
  ALTER COLUMN doc_type SET NOT NULL;

-- Make storage_path NOT NULL (after migration)
ALTER TABLE documents 
  ALTER COLUMN storage_path SET NOT NULL;

-- Make sha256 NOT NULL (will be populated on next upload)
-- For now, allow NULL for existing records
-- ALTER TABLE documents ALTER COLUMN sha256 SET NOT NULL;

-- Make metadata NOT NULL (has default)
ALTER TABLE documents 
  ALTER COLUMN metadata SET NOT NULL;

-- Make created_by NOT NULL (use a default UUID for existing records, or allow NULL temporarily)
-- For existing records without created_by, we'll allow NULL for now
-- ALTER TABLE documents ALTER COLUMN created_by SET NOT NULL;

-- Add unique constraint on (organisation_id, sha256) where sha256 is not null
-- Note: This assumes organisation_id exists. If documents can exist without org, we need to handle that.
CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_org_sha256 
ON documents(organisation_id, sha256) 
WHERE sha256 IS NOT NULL AND organisation_id IS NOT NULL;

-- Add index on (organisation_id, created_at desc)
CREATE INDEX IF NOT EXISTS idx_documents_org_created_at 
ON documents(organisation_id, created_at DESC) 
WHERE organisation_id IS NOT NULL;

-- Add GIN index on metadata
CREATE INDEX IF NOT EXISTS idx_documents_metadata_gin 
ON documents USING GIN (metadata jsonb_path_ops);

-- ============================================================================
-- 2. Create document_links junction table
-- ============================================================================

CREATE TABLE IF NOT EXISTS document_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organisation_id UUID NOT NULL,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('FINANCE_TRANSACTION', 'INVOICE', 'DEAL', 'ORGANISATION', 'CONTACT', 'PROJECT')),
  entity_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'SUPPORTING' CHECK (role IN ('PRIMARY', 'SOURCE', 'SUPPORTING', 'RECEIPT', 'CONTRACT', 'BANK_PROOF', 'OTHER')),
  note TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_by UUID,
  deleted_at TIMESTAMPTZ
);

-- Add foreign key constraint for organisation_id (if organisations table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'organisations') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'document_links_organisation_id_fkey' 
      AND table_name = 'document_links'
    ) THEN
      ALTER TABLE document_links 
      ADD CONSTRAINT document_links_organisation_id_fkey 
      FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- Unique constraint: one active link per (document, entity_type, entity_id) per org
CREATE UNIQUE INDEX IF NOT EXISTS idx_document_links_unique_active 
ON document_links(organisation_id, document_id, entity_type, entity_id) 
WHERE is_deleted = false;

-- Index for listing links by entity
CREATE INDEX IF NOT EXISTS idx_document_links_entity 
ON document_links(organisation_id, entity_type, entity_id, created_at DESC) 
WHERE is_deleted = false;

-- Index for listing links by document
CREATE INDEX IF NOT EXISTS idx_document_links_document 
ON document_links(organisation_id, document_id, created_at DESC) 
WHERE is_deleted = false;

-- Partial index for active links
CREATE INDEX IF NOT EXISTS idx_document_links_active 
ON document_links(organisation_id, entity_type, entity_id) 
WHERE is_deleted = false;

-- ============================================================================
-- 3. Create convenience view for finance transactions
-- ============================================================================

CREATE OR REPLACE VIEW v_finance_transaction_documents AS
SELECT 
  dl.id as link_id,
  dl.organisation_id,
  dl.entity_id as transaction_id,
  dl.role,
  dl.note,
  dl.created_at as linked_at,
  d.id as document_id,
  d.title,
  d.doc_type,
  d.storage_path,
  d.file_name,
  d.mime_type,
  COALESCE(d.file_size_bytes, d.file_size) as file_size_bytes,
  d.metadata,
  d.created_at as document_created_at,
  d.created_by as document_created_by
FROM document_links dl
INNER JOIN documents d ON dl.document_id = d.id
WHERE dl.entity_type = 'FINANCE_TRANSACTION'
  AND dl.is_deleted = false;

-- ============================================================================
-- 4. Row Level Security (RLS)
-- ============================================================================

-- Enable RLS on document_links
ALTER TABLE document_links ENABLE ROW LEVEL SECURITY;

-- Drop existing permissive policies on documents (if any)
DROP POLICY IF EXISTS "Allow all operations on documents" ON documents;

-- Documents: SELECT - allow if user can access the organisation
-- Note: This assumes a simple org-based access. Adjust based on your auth setup.
CREATE POLICY "documents_select_org_member" ON documents
  FOR SELECT
  USING (
    -- For now, allow if organisation_id is accessible
    -- In production, check org membership via auth.uid() and org_memberships table
    true  -- TODO: Replace with proper org membership check
  );

-- Documents: INSERT - allow if user is member of org
CREATE POLICY "documents_insert_org_member" ON documents
  FOR INSERT
  WITH CHECK (
    -- For now, allow if organisation_id is set
    -- In production, check org membership via auth.uid() and org_memberships table
    organisation_id IS NOT NULL  -- TODO: Replace with proper org membership check
  );

-- Documents: UPDATE - allow if user is member of org and (created_by=user or admin)
CREATE POLICY "documents_update_org_member" ON documents
  FOR UPDATE
  USING (
    -- For now, allow if organisation_id is accessible
    -- In production: check org membership AND (created_by = auth.uid() OR user is admin)
    true  -- TODO: Replace with proper org membership and ownership check
  )
  WITH CHECK (
    -- Same check for WITH CHECK
    true  -- TODO: Replace with proper org membership and ownership check
  );

-- Documents: DELETE - disallow (prefer soft delete via document_links)
-- No DELETE policy = no deletes allowed

-- Document Links: SELECT - allow if member of org
CREATE POLICY "document_links_select_org_member" ON document_links
  FOR SELECT
  USING (
    -- For now, allow if organisation_id is accessible
    -- In production, check org membership via auth.uid() and org_memberships table
    true  -- TODO: Replace with proper org membership check
  );

-- Document Links: INSERT - allow if member of org
CREATE POLICY "document_links_insert_org_member" ON document_links
  FOR INSERT
  WITH CHECK (
    -- For now, allow if organisation_id is set
    -- In production, check org membership via auth.uid() and org_memberships table
    organisation_id IS NOT NULL  -- TODO: Replace with proper org membership check
  );

-- Document Links: UPDATE - allow only for soft delete fields and only if member of org
CREATE POLICY "document_links_update_soft_delete" ON document_links
  FOR UPDATE
  USING (
    -- For now, allow if organisation_id is accessible
    -- In production, check org membership via auth.uid() and org_memberships table
    true  -- TODO: Replace with proper org membership check
  )
  WITH CHECK (
    -- Only allow updating soft delete fields
    -- In production: check org membership AND only is_deleted, deleted_by, deleted_at can change
    true  -- TODO: Replace with proper org membership check and field restrictions
  );

-- Document Links: DELETE - disallow
-- No DELETE policy = no hard deletes allowed

-- ============================================================================
-- 5. Comments
-- ============================================================================

COMMENT ON TABLE document_links IS 'Junction table for linking documents to various entities (transactions, invoices, deals, etc.)';
COMMENT ON COLUMN document_links.is_deleted IS 'Soft delete flag. Use this instead of hard delete to maintain audit trail.';
COMMENT ON COLUMN documents.sha256 IS 'SHA256 hash of file content for idempotent uploads. Unique per organisation.';
COMMENT ON COLUMN documents.metadata IS 'JSONB metadata field for storing document-specific data (e.g. invoice_no, issuer_name, etc.)';

