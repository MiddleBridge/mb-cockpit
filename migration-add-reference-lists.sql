-- Migration: Create reference lists tables for locations, sectors, and websites
-- These tables store available options that can be selected in organisations and contacts

-- Create locations table
CREATE TABLE IF NOT EXISTS locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Note: sectors table already exists in Supabase with structure:
-- id (int8), name (text), slug (text), created_at (timestamptz)
-- Do not create it here

-- Create websites table (for storing common website domains/patterns)
CREATE TABLE IF NOT EXISTS websites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_locations_name ON locations(name);
-- Note: sectors table already has indexes
CREATE INDEX IF NOT EXISTS idx_websites_url ON websites(url);

-- Enable Row Level Security
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
-- Note: sectors table RLS already configured
ALTER TABLE websites ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all operations for now)
DROP POLICY IF EXISTS "Allow all operations on locations" ON locations;
CREATE POLICY "Allow all operations on locations" ON locations FOR ALL USING (true);

-- Note: sectors table policies already configured

DROP POLICY IF EXISTS "Allow all operations on websites" ON websites;
CREATE POLICY "Allow all operations on websites" ON websites FOR ALL USING (true);

-- Insert cities/locations for organizations (common business hubs)
-- Note: For contacts, location uses countries (see ContactsView.tsx)
-- For organizations, location should be cities
INSERT INTO locations (name) VALUES 
  ('Dubai, UAE'), ('Abu Dhabi, UAE'), ('Sharjah, UAE'),
  ('London, UK'), ('Manchester, UK'), ('Birmingham, UK'),
  ('Warsaw, Poland'), ('Krakow, Poland'), ('Wroclaw, Poland'), ('Gdansk, Poland'),
  ('Berlin, Germany'), ('Munich, Germany'), ('Frankfurt, Germany'), ('Hamburg, Germany'),
  ('Paris, France'), ('Lyon, France'), ('Marseille, France'),
  ('New York, USA'), ('Los Angeles, USA'), ('San Francisco, USA'), ('Chicago, USA'), ('Boston, USA'),
  ('Singapore'), ('Hong Kong'), ('Tokyo, Japan'), ('Osaka, Japan'),
  ('Sydney, Australia'), ('Melbourne, Australia'),
  ('Toronto, Canada'), ('Vancouver, Canada'),
  ('Amsterdam, Netherlands'), ('Rotterdam, Netherlands'),
  ('Stockholm, Sweden'), ('Copenhagen, Denmark'), ('Oslo, Norway'),
  ('Zurich, Switzerland'), ('Geneva, Switzerland'),
  ('Barcelona, Spain'), ('Madrid, Spain'),
  ('Milan, Italy'), ('Rome, Italy'),
  ('Vienna, Austria'), ('Prague, Czech Republic'),
  ('Brussels, Belgium'), ('Luxembourg'),
  ('Dublin, Ireland'),
  ('Tel Aviv, Israel'), ('Riyadh, Saudi Arabia'), ('Doha, Qatar'), ('Kuwait City, Kuwait'),
  ('Mumbai, India'), ('Delhi, India'), ('Bangalore, India'),
  ('Shanghai, China'), ('Beijing, China'), ('Hong Kong'),
  ('Seoul, South Korea'), ('Tokyo, Japan'),
  ('Bangkok, Thailand'), ('Jakarta, Indonesia'), ('Manila, Philippines'),
  ('São Paulo, Brazil'), ('Mexico City, Mexico'), ('Buenos Aires, Argentina')
ON CONFLICT (name) DO NOTHING;

-- Note: sectors table already populated in Supabase with:
-- Aerospace, Agriculture, Automotive, Banking, Biotechnology, Construction,
-- Consulting, Defense, E-Commerce, E-Learning, Education, Energy, Finance,
-- Fintech, Food & Beverage, Government, Healthcare, Hospitality & Tourism,
-- Human Resources, Insurance, Legal Services, Manufacturing, Marketing & Advertising,
-- Media & Entertainment, Non-Profit, Oil & Gas, Other, Pharmaceuticals,
-- Real Estate, Renewable Energy, Retail, SaaS, Software, Technology,
-- Telecommunications, Transportation & Logistics
-- Do not insert here - use existing data

