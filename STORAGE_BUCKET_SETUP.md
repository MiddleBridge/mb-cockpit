# Storage Bucket Setup - Quick Fix

## Problem: "Bucket not found" Error

Jeśli widzisz błąd:
```
Error: Bucket not found
StorageApiError: Bucket not found
```

To znaczy, że bucket Storage nie istnieje w Supabase.

## Szybkie rozwiązanie (2 minuty)

### Krok 1: Utwórz bucket "documents"

1. Otwórz **Supabase Dashboard** → **Storage**
2. Kliknij **"New bucket"**
3. **Nazwa**: `documents`
4. **Public bucket**: Włącz (toggle ON) - **WAŻNE!**
5. Kliknij **"Create bucket"**

### Krok 2: (Opcjonalnie) Utwórz RLS policies

Jeśli nadal masz problemy z uprawnieniami, uruchom w **SQL Editor**:

```sql
-- Allow public read access
CREATE POLICY "Allow public read access"
ON storage.objects FOR SELECT
USING (bucket_id = 'documents');

-- Allow public upload
CREATE POLICY "Allow public upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'documents');
```

Lub użyj pliku: `migration-storage-policies.sql` (zmień `mb-cockpit` na `documents`)

## Alternatywa: Użyj istniejącego bucketu

Jeśli masz już bucket `mb-cockpit`, możesz:

1. Ustaw zmienną środowiskową:
   ```env
   NEXT_PUBLIC_STORAGE_BUCKET=mb-cockpit
   ```

2. Albo zmień kod, żeby używał `mb-cockpit` zamiast `documents`

## Weryfikacja

Po utworzeniu bucketu:
1. Odśwież stronę
2. Spróbuj wrzucić wyciąg bankowy ponownie
3. Błąd powinien zniknąć

