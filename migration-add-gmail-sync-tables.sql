-- Create gmail_messages table
CREATE TABLE IF NOT EXISTS gmail_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email text NOT NULL,  -- Using user_email to match existing pattern
  gmail_message_id text NOT NULL,
  thread_id text NOT NULL,
  from_email text,
  from_name text,
  to_email text,
  to_name text,
  subject text,
  snippet text,
  internal_date timestamptz,
  has_attachments boolean DEFAULT false,
  raw_header jsonb,      -- optional, for future use
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_email, gmail_message_id)
);

-- Create gmail_attachments table
CREATE TABLE IF NOT EXISTS gmail_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email text NOT NULL,
  gmail_message_id text NOT NULL,
  gmail_attachment_id text NOT NULL,
  file_name text,
  mime_type text,
  size_bytes int,
  supabase_file_path text,  -- will be filled when file is downloaded to Supabase storage
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_email, gmail_attachment_id)
);

-- Enable Row Level Security (RLS)
ALTER TABLE gmail_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE gmail_attachments ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all operations for now, can be restricted later)
CREATE POLICY "Allow all operations on gmail_messages" ON gmail_messages FOR ALL USING (true);
CREATE POLICY "Allow all operations on gmail_attachments" ON gmail_attachments FOR ALL USING (true);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_gmail_messages_user_email ON gmail_messages(user_email);
CREATE INDEX IF NOT EXISTS idx_gmail_messages_gmail_message_id ON gmail_messages(gmail_message_id);
CREATE INDEX IF NOT EXISTS idx_gmail_attachments_user_email ON gmail_attachments(user_email);
CREATE INDEX IF NOT EXISTS idx_gmail_attachments_gmail_message_id ON gmail_attachments(gmail_message_id);
CREATE INDEX IF NOT EXISTS idx_gmail_attachments_gmail_attachment_id ON gmail_attachments(gmail_attachment_id);

