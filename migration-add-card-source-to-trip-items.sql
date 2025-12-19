-- Migration: Add card_source column to finance_trip_items
-- Run this in Supabase SQL Editor

-- Add card_source column
ALTER TABLE finance_trip_items
ADD COLUMN IF NOT EXISTS card_source TEXT NULL;

-- Add comment for documentation
COMMENT ON COLUMN finance_trip_items.card_source IS 'Card used for payment: MB, PKO, or REVOLUT';

-- Optional: Add check constraint to enforce allowed values
-- ALTER TABLE finance_trip_items
-- ADD CONSTRAINT check_card_source 
-- CHECK (card_source IS NULL OR card_source IN ('MB', 'PKO', 'REVOLUT'));

