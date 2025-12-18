# Fix: Storage Bucket Upload - Use Service Role Key

## Problem
- Upload używał anon key zamiast service role key
- `listBuckets()` zwracał pustą tablicę (brak uprawnień)
- Kod blokował upload na podstawie niepracującego checku

## Solution

### 1. Created server-side Supabase client
- **File**: `src/server/supabase/server.ts`
- Używa `SUPABASE_URL` (lub `NEXT_PUBLIC_SUPABASE_URL` jako fallback)
- Używa `SUPABASE_SERVICE_ROLE_KEY` (ma pełne uprawnienia)

### 2. Refactored upload function
- **File**: `src/server/documents/upload.ts`
- Usunięto cały blok z `listBuckets()` i sprawdzaniem bucketów
- Bucket ustawiony na sztywno: `mb-cockpit`
- Używa server client z service role key

### 3. Environment Variables Required

Na Vercel musisz mieć:
- `SUPABASE_URL` = ten sam co `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` = service role key z Supabase Dashboard

## Changes Made

1. ✅ Utworzono `src/server/supabase/server.ts` - server-side client helper
2. ✅ Zmieniono import w `upload.ts` na server client
3. ✅ Usunięto `listBuckets()` check
4. ✅ Bucket ustawiony na sztywno: `mb-cockpit`
5. ✅ Uproszczono obsługę błędów

## Next Steps

1. **Dodaj ENV na Vercel**:
   - `SUPABASE_URL` = wartość z `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` = service role key

2. **Redeploy** na Vercel

3. **Test upload** - powinien działać bez błędów

