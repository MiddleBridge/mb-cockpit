-- Instrukcje sprawdzania czy kontakty są zapisywane w bazie danych
-- Wykonaj te zapytania w Supabase SQL Editor

-- 1. Sprawdź ile masz kontaktów w bazie
SELECT COUNT(*) as total_contacts FROM contacts;

-- 2. Zobacz wszystkie kontakty z podstawowymi informacjami
SELECT 
  id,
  name,
  organization,
  email,
  status,
  created_at,
  updated_at
FROM contacts
ORDER BY created_at DESC
LIMIT 20;

-- 3. Sprawdź najnowsze kontakty (ostatnie 5)
SELECT 
  name,
  organization,
  email,
  status,
  created_at
FROM contacts
ORDER BY created_at DESC
LIMIT 5;

-- 4. Sprawdź czy są jakieś kontakty bez organizacji
SELECT 
  name,
  email,
  status,
  created_at
FROM contacts
WHERE organization IS NULL OR organization = ''
ORDER BY created_at DESC;

-- 5. Sprawdź strukturę tabeli (czy wszystkie kolumny istnieją)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'contacts'
ORDER BY ordinal_position;

-- 6. Sprawdź czy są jakieś błędy w danych (kontakty bez imienia)
SELECT 
  id,
  name,
  organization,
  created_at
FROM contacts
WHERE name IS NULL OR name = '';

-- 7. Sprawdź ostatni dodany kontakt (najnowszy)
SELECT 
  id,
  name,
  organization,
  email,
  status,
  role,
  location,
  nationality,
  created_at
FROM contacts
ORDER BY created_at DESC
LIMIT 1;

-- 8. Sprawdź czy są duplikaty (te same imię + organizacja)
SELECT 
  name,
  organization,
  COUNT(*) as count
FROM contacts
GROUP BY name, organization
HAVING COUNT(*) > 1;

-- 9. Sprawdź wszystkie kolumny dla konkretnego kontaktu (zamień 'testete' na imię kontaktu który dodałeś)
SELECT *
FROM contacts
WHERE name ILIKE '%testete%'
   OR name ILIKE '%test%'
ORDER BY created_at DESC;

-- 10. Sprawdź czy RLS (Row Level Security) nie blokuje zapisu
-- To powinno zwrócić informacje o politykach bezpieczeństwa
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'contacts';

