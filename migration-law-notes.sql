-- Create law_notes table
CREATE TABLE IF NOT EXISTS law_notes (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Enable Row Level Security (RLS)
ALTER TABLE law_notes ENABLE ROW LEVEL SECURITY;

-- Create policy (allow all operations for now)
DROP POLICY IF EXISTS "Allow all operations on law_notes" ON law_notes;
CREATE POLICY "Allow all operations on law_notes" ON law_notes FOR ALL USING (true);



