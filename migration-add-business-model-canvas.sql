-- Create business_model_canvas table
CREATE TABLE IF NOT EXISTS business_model_canvas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_name TEXT NOT NULL UNIQUE,
  customer_segments TEXT DEFAULT '',
  value_propositions TEXT DEFAULT '',
  channels TEXT DEFAULT '',
  customer_relationships TEXT DEFAULT '',
  revenue_streams TEXT DEFAULT '',
  key_resources TEXT DEFAULT '',
  key_activities TEXT DEFAULT '',
  key_partnerships TEXT DEFAULT '',
  cost_structure TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Enable Row Level Security (RLS)
ALTER TABLE business_model_canvas ENABLE ROW LEVEL SECURITY;

-- Create policy (allow all operations for now)
CREATE POLICY "Allow all operations on business_model_canvas" ON business_model_canvas FOR ALL USING (true);




