-- Add document_type column to documents table
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS document_type TEXT;

-- Add comment
COMMENT ON COLUMN documents.document_type IS 'Rodzaj dokumentu (np. umowa, faktura, oferta)';


