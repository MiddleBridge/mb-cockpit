# Setup Documents Feature

## Problem: 404 Error for documents table

If you see `Failed to load resource: the server responded with a status of 404` for `/rest/v1/documents`, it means the `documents` table doesn't exist in your database.

## Solution: Run Migration

1. **Open Supabase Dashboard** → **SQL Editor**

2. **Copy and paste** the contents of `migration-add-documents.sql`:

```sql
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
```

3. **Click "Run"**

4. **Verify**: Go to **Table Editor** → you should see `documents` table

## Bucket Setup

If you see "Bucket not found" errors:

1. **Create bucket**:
   - Go to **Storage** → **New bucket**
   - Name: `mb-cockpit`
   - Make it **Public**
   - Click "Create bucket"

2. **Create RLS policies**:
   - Run `migration-storage-policies.sql` in SQL Editor
   - OR manually create policies in **Storage** → **Policies**

## After Setup

Refresh the page and try adding a document again. The 404 errors should be gone.




