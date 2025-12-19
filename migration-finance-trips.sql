-- Migration: Create finance trips tables for travel expense reimbursement
-- Run this in Supabase SQL Editor

-- A) Create finance_trips table
CREATE TABLE IF NOT EXISTS finance_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','reimbursed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- B) Create finance_trip_items table
CREATE TABLE IF NOT EXISTS finance_trip_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  trip_id UUID NOT NULL REFERENCES finance_trips(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('transaction','manual')),
  transaction_id UUID REFERENCES finance_transactions(id),
  item_date DATE,
  vendor TEXT,
  description TEXT,
  category TEXT,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'PLN',
  paid_by_company_card BOOLEAN NOT NULL DEFAULT false,
  exclude_from_reimbursement BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- C) Create finance_trip_notes table
CREATE TABLE IF NOT EXISTS finance_trip_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  trip_id UUID NOT NULL REFERENCES finance_trips(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- D) Create finance_trip_evidence table
CREATE TABLE IF NOT EXISTS finance_trip_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  trip_id UUID NOT NULL REFERENCES finance_trips(id) ON DELETE CASCADE,
  trip_item_id UUID REFERENCES finance_trip_items(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size BIGINT,
  storage_bucket TEXT NOT NULL DEFAULT 'trip-evidence',
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_finance_trip_items_trip_id ON finance_trip_items(trip_id);
CREATE INDEX IF NOT EXISTS idx_finance_trip_items_org_id ON finance_trip_items(org_id);
CREATE INDEX IF NOT EXISTS idx_finance_trip_items_transaction_id ON finance_trip_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_finance_trip_evidence_trip_item_id ON finance_trip_evidence(trip_item_id);
CREATE INDEX IF NOT EXISTS idx_finance_trip_evidence_trip_id ON finance_trip_evidence(trip_id);
CREATE INDEX IF NOT EXISTS idx_finance_trip_notes_trip_id ON finance_trip_notes(trip_id);

-- Unique index to prevent reusing the same transaction twice
CREATE UNIQUE INDEX IF NOT EXISTS finance_trip_items_transaction_unique 
  ON finance_trip_items(transaction_id) 
  WHERE transaction_id IS NOT NULL;

-- Trigger to update updated_at on finance_trips
CREATE OR REPLACE FUNCTION update_finance_trips_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS finance_trips_updated_at ON finance_trips;
CREATE TRIGGER finance_trips_updated_at
  BEFORE UPDATE ON finance_trips
  FOR EACH ROW
  EXECUTE FUNCTION update_finance_trips_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE finance_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_trip_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_trip_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_trip_evidence ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (using existing pattern: USING (true))
DROP POLICY IF EXISTS "Allow all operations on finance_trips" ON finance_trips;
CREATE POLICY "Allow all operations on finance_trips" 
  ON finance_trips FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on finance_trip_items" ON finance_trip_items;
CREATE POLICY "Allow all operations on finance_trip_items" 
  ON finance_trip_items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on finance_trip_notes" ON finance_trip_notes;
CREATE POLICY "Allow all operations on finance_trip_notes" 
  ON finance_trip_notes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on finance_trip_evidence" ON finance_trip_evidence;
CREATE POLICY "Allow all operations on finance_trip_evidence" 
  ON finance_trip_evidence FOR ALL USING (true) WITH CHECK (true);

