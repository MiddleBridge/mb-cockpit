-- Add invoice-related columns to documents table
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS invoice_type text CHECK (invoice_type IN ('cost', 'revenue')) NULL,
  ADD COLUMN IF NOT EXISTS amount_original numeric NULL,
  ADD COLUMN IF NOT EXISTS currency text NULL,
  ADD COLUMN IF NOT EXISTS amount_base numeric NULL,
  ADD COLUMN IF NOT EXISTS base_currency text NULL,
  ADD COLUMN IF NOT EXISTS invoice_date date NULL,
  ADD COLUMN IF NOT EXISTS invoice_year int NULL,
  ADD COLUMN IF NOT EXISTS invoice_month int NULL;

-- Add indexes for faster invoice queries
CREATE INDEX IF NOT EXISTS idx_documents_invoice_type ON documents(invoice_type);
CREATE INDEX IF NOT EXISTS idx_documents_invoice_year ON documents(invoice_year);
CREATE INDEX IF NOT EXISTS idx_documents_invoice_month ON documents(invoice_month);
CREATE INDEX IF NOT EXISTS idx_documents_invoice_year_month ON documents(invoice_year, invoice_month);

