-- Migration: Add subscription detection tables for recurring costs
-- This enables detection of recurring expenses like Google Workspace, Squarespace, rent, accounting

-- 1) Rules: deterministic matching using regex
CREATE TABLE IF NOT EXISTS finance_subscription_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  vendor_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  match_regex TEXT NOT NULL,
  cadence TEXT NOT NULL DEFAULT 'monthly',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fin_sub_rules_org ON finance_subscription_rules(org_id);

-- 2) Detected subscriptions (recurring costs)
CREATE TABLE IF NOT EXISTS finance_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  vendor_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  cadence TEXT NOT NULL,                       -- monthly
  currency TEXT NOT NULL DEFAULT 'PLN',
  avg_amount NUMERIC(12,2) NOT NULL,           -- stored as positive
  amount_tolerance NUMERIC(12,2) NOT NULL DEFAULT 5.00,
  last_charge_date DATE,
  next_expected_date DATE,
  first_seen_date DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  confidence NUMERIC(5,2) NOT NULL DEFAULT 0,  -- 0-100
  source TEXT NOT NULL DEFAULT 'auto',         -- auto | rule | manual
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, vendor_key, cadence, currency)
);

CREATE INDEX IF NOT EXISTS idx_fin_subs_org ON finance_subscriptions(org_id);
CREATE INDEX IF NOT EXISTS idx_fin_subs_active ON finance_subscriptions(org_id, active) WHERE active = true;

-- 3) Join table: which transactions belong to which subscription
CREATE TABLE IF NOT EXISTS finance_subscription_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  subscription_id UUID NOT NULL REFERENCES finance_subscriptions(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES finance_transactions(id) ON DELETE CASCADE,
  service_period_month DATE,                   -- first day of month, for allocation
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, subscription_id, transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_fin_sub_tx_org ON finance_subscription_transactions(org_id);
CREATE INDEX IF NOT EXISTS idx_fin_sub_tx_sub ON finance_subscription_transactions(subscription_id);
CREATE INDEX IF NOT EXISTS idx_fin_sub_tx_tx ON finance_subscription_transactions(transaction_id);

-- RLS: copy the exact org-based policy pattern used on finance_transactions
ALTER TABLE finance_subscription_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_subscription_transactions ENABLE ROW LEVEL SECURITY;

-- Policies (allow all for now, same as finance_transactions)
DROP POLICY IF EXISTS "Allow all operations on finance_subscription_rules" ON finance_subscription_rules;
CREATE POLICY "Allow all operations on finance_subscription_rules" 
  ON finance_subscription_rules FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations on finance_subscriptions" ON finance_subscriptions;
CREATE POLICY "Allow all operations on finance_subscriptions" 
  ON finance_subscriptions FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations on finance_subscription_transactions" ON finance_subscription_transactions;
CREATE POLICY "Allow all operations on finance_subscription_transactions" 
  ON finance_subscription_transactions FOR ALL USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_finance_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER finance_subscriptions_updated_at
  BEFORE UPDATE ON finance_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_finance_subscriptions_updated_at();

