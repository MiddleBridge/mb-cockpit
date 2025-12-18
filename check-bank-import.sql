-- DIAGNOSTYKA: Sprawdź czy import wyciągu bankowego działa
-- Uruchom w Supabase SQL Editor

-- 1. Sprawdź czy są dokumenty typu BANK_CONFIRMATION
SELECT 
  id,
  name,
  doc_type,
  organisation_id,
  storage_path,
  created_at
FROM documents
WHERE doc_type = 'BANK_CONFIRMATION'
ORDER BY created_at DESC
LIMIT 10;

-- 2. Sprawdź ile jest transakcji w tabeli
SELECT 
  COUNT(*) as total_transactions,
  COUNT(DISTINCT org_id) as orgs_with_transactions,
  COUNT(DISTINCT source_document_id) as documents_with_transactions,
  MIN(booking_date) as earliest_date,
  MAX(booking_date) as latest_date
FROM finance_transactions;

-- 3. Sprawdź transakcje z ostatnich dokumentów
SELECT 
  ft.id,
  ft.org_id,
  ft.source_document_id,
  ft.booking_date,
  ft.amount,
  ft.currency,
  ft.direction,
  ft.description,
  ft.category,
  ft.created_at,
  d.name as document_name,
  d.created_at as document_created_at
FROM finance_transactions ft
LEFT JOIN documents d ON ft.source_document_id = d.id
ORDER BY ft.created_at DESC
LIMIT 20;

-- 4. Sprawdź czy dokumenty BANK_CONFIRMATION mają powiązane transakcje
SELECT 
  d.id as document_id,
  d.name as document_name,
  d.created_at as document_created_at,
  COUNT(ft.id) as transaction_count
FROM documents d
LEFT JOIN finance_transactions ft ON ft.source_document_id = d.id
WHERE d.doc_type = 'BANK_CONFIRMATION'
GROUP BY d.id, d.name, d.created_at
ORDER BY d.created_at DESC;

-- 5. Sprawdź przykładowe transakcje z kategoriami
SELECT 
  category,
  COUNT(*) as count,
  SUM(CASE WHEN direction = 'in' THEN amount ELSE 0 END) as total_in,
  SUM(CASE WHEN direction = 'out' THEN amount ELSE 0 END) as total_out
FROM finance_transactions
GROUP BY category
ORDER BY count DESC;

