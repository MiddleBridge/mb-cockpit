# Setup Supabase CLI dla automatycznych migracji

## Krok 1: Zainstaluj Supabase CLI

```bash
npm install -g supabase
```

Lub używając innych menedżerów pakietów:
- Windows (Scoop): `scoop bucket add supabase https://github.com/supabase/scoop-bucket.git && scoop install supabase`
- macOS (Homebrew): `brew install supabase/tap/supabase`
- Linux: Zobacz https://supabase.com/docs/guides/cli

## Krok 2: Zaloguj się

```bash
supabase login
```

To otworzy przeglądarkę do logowania.

## Krok 3: Połącz projekt

```bash
supabase link --project-ref your-project-ref
```

`your-project-ref` znajdziesz w URL Supabase Dashboard:
- URL: `https://app.supabase.com/project/abcdefghijklmnop`
- Project ref: `abcdefghijklmnop`

## Krok 4: Zainicjalizuj strukturę migracji (opcjonalnie)

```bash
supabase init
```

To utworzy folder `supabase/` z konfiguracją.

## Krok 5: Użyj skryptu migracji

```bash
npm run migrate
```

Lub dla konkretnego pliku:
```bash
npm run migrate migration-fix-projects-table.sql
```

## Alternatywa: Bezpośrednie użycie Supabase CLI

Możesz też przenieść pliki migracji do `supabase/migrations/` i użyć:

```bash
supabase db push
```

To automatycznie zastosuje wszystkie migracje w kolejności.




