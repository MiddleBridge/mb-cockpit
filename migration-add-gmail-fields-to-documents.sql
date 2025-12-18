-- Add Gmail source fields to documents table
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS source_gmail_message_id text NULL,
  ADD COLUMN IF NOT EXISTS source_gmail_attachment_id text NULL,
  ADD COLUMN IF NOT EXISTS contact_email text NULL,
  ADD COLUMN IF NOT EXISTS contact_name text NULL,
  ADD COLUMN IF NOT EXISTS organisation_name_guess text NULL;

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_documents_source_gmail_message_id ON documents(source_gmail_message_id);
CREATE INDEX IF NOT EXISTS idx_documents_source_gmail_attachment_id ON documents(source_gmail_attachment_id);
CREATE INDEX IF NOT EXISTS idx_documents_contact_email ON documents(contact_email);

