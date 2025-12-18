-- Migration: Seed subscription rules for Middle Bridge
-- Run this AFTER migration-add-subscription-detection.sql
-- This will add rules for ALL organisations in the database

-- Insert rules for all existing organisations
INSERT INTO finance_subscription_rules (org_id, vendor_key, display_name, match_regex, cadence, is_enabled)
SELECT 
  o.id as org_id,
  'google_workspace' as vendor_key,
  'Google Workspace' as display_name,
  '(?i)google\s+(workspace|gsuite)|gcpld\d+' as match_regex,
  'monthly' as cadence,
  true as is_enabled
FROM organisations o
WHERE NOT EXISTS (
  SELECT 1 FROM finance_subscription_rules r 
  WHERE r.org_id = o.id AND r.vendor_key = 'google_workspace'
)

UNION ALL

SELECT 
  o.id as org_id,
  'squarespace' as vendor_key,
  'Squarespace' as display_name,
  '(?i)\bsqsp\*|squarespace' as match_regex,
  'monthly' as cadence,
  true as is_enabled
FROM organisations o
WHERE NOT EXISTS (
  SELECT 1 FROM finance_subscription_rules r 
  WHERE r.org_id = o.id AND r.vendor_key = 'squarespace'
)

UNION ALL

SELECT 
  o.id as org_id,
  'rent' as vendor_key,
  'Rent' as display_name,
  '(?i)\bnajem\b|czynsz|op\s*łata\s*za\s*[a-ząćęłńóśźż]+\s*\d{4}' as match_regex,
  'monthly' as cadence,
  true as is_enabled
FROM organisations o
WHERE NOT EXISTS (
  SELECT 1 FROM finance_subscription_rules r 
  WHERE r.org_id = o.id AND r.vendor_key = 'rent'
)

UNION ALL

SELECT 
  o.id as org_id,
  'hermi_accounting' as vendor_key,
  'HERMI (accounting)' as display_name,
  '(?i)\bhermi\b|joanna\s+koszulska|biuro\s+rachunkowe' as match_regex,
  'monthly' as cadence,
  true as is_enabled
FROM organisations o
WHERE NOT EXISTS (
  SELECT 1 FROM finance_subscription_rules r 
  WHERE r.org_id = o.id AND r.vendor_key = 'hermi_accounting'
);

-- To verify the rules were created, run:
-- SELECT r.*, o.name as org_name 
-- FROM finance_subscription_rules r 
-- JOIN organisations o ON r.org_id = o.id;

