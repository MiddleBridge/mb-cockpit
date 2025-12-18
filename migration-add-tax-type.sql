-- Add tax_type column to documents table
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS tax_type TEXT CHECK (tax_type IN ('CIT', 'VAT'));

-- Add comment
COMMENT ON COLUMN documents.tax_type IS 'Type of tax: CIT (Corporate Income Tax) or VAT (Value Added Tax)';

