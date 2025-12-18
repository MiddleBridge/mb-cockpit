-- Migration: Create finance_transactions table for bank statement imports
-- Run this in Supabase SQL Editor

-- Create finance_transactions table
CREATE TABLE IF NOT EXISTS finance_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  source_document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  booking_date DATE NOT NULL,
  value_date DATE,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'PLN',
  description TEXT NOT NULL,
  counterparty_name TEXT,
  counterparty_account TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  category TEXT NOT NULL DEFAULT 'uncategorised',
  subcategory TEXT,
  transaction_hash TEXT NOT NULL,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add unique constraint for idempotency
CREATE UNIQUE INDEX IF NOT EXISTS idx_finance_transactions_org_hash 
  ON finance_transactions(org_id, transaction_hash);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_finance_transactions_org_date 
  ON finance_transactions(org_id, booking_date DESC);

CREATE INDEX IF NOT EXISTS idx_finance_transactions_document 
  ON finance_transactions(source_document_id);

CREATE INDEX IF NOT EXISTS idx_finance_transactions_category 
  ON finance_transactions(category);

-- Enable Row Level Security (RLS)
ALTER TABLE finance_transactions ENABLE ROW LEVEL SECURITY;

-- Create policy: allow all operations for org members (adjust based on your auth setup)
-- For now, allow all operations (you should restrict this based on user authentication)
DROP POLICY IF EXISTS "Allow all operations on finance_transactions" ON finance_transactions;
CREATE POLICY "Allow all operations on finance_transactions" 
  ON finance_transactions FOR ALL USING (true);

