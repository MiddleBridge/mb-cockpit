# Diagnostic: Storage Bucket "Bucket not found"

## Problem
Aplikacja próbuje uploadować plik do bucketu `documents`, ale dostaje błąd:
```
StorageApiError: Bucket not found
status: 400
statusCode: '404'
```

## Diagnostyka

Dodałem logowanie w `src/server/documents/upload.ts` które pokaże:

1. **Supabase URL fingerprint** - pierwsze 20 znaków URL (żeby sprawdzić czy to właściwy projekt)
2. **Nazwa bucketu** - jaki bucket próbujemy użyć (`documents` lub `mb-cockpit`)
3. **Lista dostępnych bucketów** - jakie buckety widzi aplikacja w tym projekcie Supabase
4. **Błąd listBuckets** - czy w ogóle możemy połączyć się z Storage API

## Co sprawdzić w logach Vercel

Po następnym uploadzie, w logach Vercel zobaczysz:

```
🔍 [UPLOAD DIAGNOSTIC] {
  supabaseUrl: "https://xxxxx.supabase.co...",
  preferredBucket: "documents",
  fallbackBucket: "mb-cockpit",
  envBucket: "not_set" | "documents"
}

🔍 [UPLOAD DIAGNOSTIC] Available buckets: {
  buckets: ["mb-cockpit", "company-files"],
  count: 2,
  listError: null
}
```

## Najczęstsze przyczyny

### 1. Zła nazwa bucketu (case-sensitive)
- Kod: `documents`
- Supabase: `Documents` lub `mb-cockpit`
- **Fix**: Zmień kod na właściwą nazwę lub utwórz bucket `documents`

### 2. Aplikacja łączy się z innym projektem Supabase
- `NEXT_PUBLIC_SUPABASE_URL` w Vercel wskazuje inny projekt niż ten w dashboardzie
- **Fix**: Sprawdź w Vercel → Settings → Environment Variables:
  - `NEXT_PUBLIC_SUPABASE_URL` musi być identyczny z URL w Supabase Dashboard
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` musi pochodzić z tego samego projektu

### 3. Różne klucze na serwerze i kliencie
- Klient używa `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Serwer używa `SUPABASE_SERVICE_ROLE_KEY` (jeśli jest)
- **Fix**: Upewnij się że oba wskazują ten sam projekt

## Jak naprawić

### Krok 1: Sprawdź logi
Po uploadzie sprawdź logi Vercel i znajdź:
- Jaki `supabaseUrl` jest używany
- Jakie buckety są dostępne
- Jaki bucket próbujemy użyć

### Krok 2: Porównaj z Dashboard
1. Otwórz Supabase Dashboard
2. Sprawdź URL projektu (powinien pasować do logów)
3. Sprawdź jakie buckety istnieją (Storage → Buckets)

### Krok 3: Napraw konfigurację
- Jeśli URL się nie zgadza → zaktualizuj `NEXT_PUBLIC_SUPABASE_URL` w Vercel
- Jeśli bucket nie istnieje → utwórz bucket `documents` w Supabase
- Jeśli nazwa się nie zgadza → zmień kod na właściwą nazwę

### Krok 4: Redeploy
Po zmianie ENV w Vercel, zrób redeploy (Vercel → Deployments → Redeploy)

## Test ręczny

Możesz też przetestować połączenie bezpośrednio w kodzie:

```typescript
const { data: buckets } = await supabase.storage.listBuckets();
console.log('Available buckets:', buckets?.map(b => b.name));
```

Jeśli nie widzisz `mb-cockpit` ani `company-files` w tej liście, to znaczy że łączysz się z innym projektem.

