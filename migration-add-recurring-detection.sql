-- Migration: Add recurring payment detection to finance_transactions
-- This adds fields to track if a transaction is part of a recurring payment pattern

-- Add recurring detection fields
ALTER TABLE finance_transactions
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS recurrence_pattern TEXT, -- 'monthly', 'quarterly', 'yearly', 'weekly', 'one_time'
ADD COLUMN IF NOT EXISTS recurrence_group_id TEXT; -- Groups transactions that are part of the same recurring pattern

-- Add index for recurring queries
CREATE INDEX IF NOT EXISTS idx_finance_transactions_recurring 
  ON finance_transactions(is_recurring, recurrence_group_id) 
  WHERE is_recurring = true;

-- Add index for recurrence pattern queries
CREATE INDEX IF NOT EXISTS idx_finance_transactions_recurrence_pattern 
  ON finance_transactions(recurrence_pattern) 
  WHERE recurrence_pattern IS NOT NULL;

