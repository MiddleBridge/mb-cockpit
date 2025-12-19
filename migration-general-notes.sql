-- Create general_notes table
CREATE TABLE IF NOT EXISTS general_notes (
  id TEXT PRIMARY KEY,
  title TEXT,
  content TEXT NOT NULL DEFAULT '',
  source TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Enable Row Level Security (RLS)
ALTER TABLE general_notes ENABLE ROW LEVEL SECURITY;

-- Create policy (allow all operations for now)
DROP POLICY IF EXISTS "Allow all operations on general_notes" ON general_notes;
CREATE POLICY "Allow all operations on general_notes" ON general_notes FOR ALL USING (true);
