-- Add edit_url column to documents table for Google Docs edit links
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS edit_url TEXT;

-- Add comment
COMMENT ON COLUMN documents.edit_url IS 'Original Google Docs edit URL (if document is from Google Docs)';




