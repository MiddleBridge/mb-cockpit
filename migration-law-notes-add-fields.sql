-- Add title and document_type columns to law_notes table
ALTER TABLE law_notes 
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS document_type TEXT;

-- Update existing records to have default values if needed
UPDATE law_notes 
SET title = 'Untitled Note' 
WHERE title IS NULL;

UPDATE law_notes 
SET document_type = '' 
WHERE document_type IS NULL;


