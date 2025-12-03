-- Create user_settings table for storing user preferences
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  cockpit_layout JSONB DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Enable Row Level Security (RLS)
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Drop policy if it exists, then create policy (allow all operations for now)
DROP POLICY IF EXISTS "Allow all operations on user_settings" ON user_settings;
CREATE POLICY "Allow all operations on user_settings" ON user_settings FOR ALL USING (true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

