-- Create documents table
CREATE TABLE IF NOT EXISTS documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Enable Row Level Security (RLS)
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Create policy (allow all operations for now)
CREATE POLICY "Allow all operations on documents" ON documents FOR ALL USING (true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_documents_contact_id ON documents(contact_id);
CREATE INDEX IF NOT EXISTS idx_documents_organisation_id ON documents(organisation_id);


