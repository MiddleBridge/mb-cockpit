# Jak naprawić błąd 401 "JWT could not be decoded"

## Problem

Błąd 401 oznacza, że `SUPABASE_SERVICE_ROLE_KEY` nie działa z Management API. Management API wymaga **SUPABASE_ACCESS_TOKEN** z Account Settings.

## Rozwiązanie

### Opcja 1: Dodaj SUPABASE_ACCESS_TOKEN (Zalecane)

1. **Wejdź do Supabase Dashboard:**
   - https://app.supabase.com
   - Zaloguj się

2. **Przejdź do Access Tokens:**
   - Kliknij na swoje **konto** (prawy górny róg)
   - Wybierz **Account Settings**
   - W lewym menu kliknij **Access Tokens**

3. **Utwórz nowy token:**
   - Kliknij **Generate new token**
   - Nadaj mu nazwę (np. "Auto Migrations")
   - Skopiuj wygenerowany token

4. **Dodaj do .env:**
   ```env
   SUPABASE_ACCESS_TOKEN=twój_access_token_tutaj
   ```

5. **Uruchom ponownie:**
   ```bash
   npm run migrate
   ```

### Opcja 2: Uruchom migracje ręcznie (Szybkie rozwiązanie)

Jeśli nie chcesz tworzyć ACCESS_TOKEN, możesz uruchomić migracje ręcznie:

1. **Otwórz Supabase Dashboard:**
   - https://app.supabase.com
   - Wybierz swój projekt

2. **Przejdź do SQL Editor:**
   - W lewym menu kliknij **SQL Editor**

3. **Uruchom migracje:**
   - Skopiuj zawartość każdego pliku `migration-*.sql`
   - Wklej do SQL Editor
   - Kliknij **Run**

## Które migracje uruchomić?

Z terminala widzisz listę 21 migracji. Najważniejsze to:

1. `migration-add-website-to-contacts.sql` - **NOWA, wymagana**
2. `migration-add-avatar.sql`
3. `migration-add-contact-status-sector.sql`
4. `migration-add-location-nationality.sql`
5. `migration-add-role-to-contacts.sql`
6. `migration-add-multiple-organizations-projects-to-contacts.sql`
7. ... i pozostałe

## Szybkie rozwiązanie - tylko website

Jeśli chcesz tylko dodać kolumnę `website`, uruchom w SQL Editor:

```sql
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS website TEXT;
```

## Po uruchomieniu migracji ręcznie

Po uruchomieniu migracji w SQL Editor, możesz oznaczyć je jako wykonane:

1. Utwórz plik `.migrations-log.json` w głównym katalogu
2. Dodaj nazwy wykonanych migracji:

```json
[
  "migration-add-website-to-contacts.sql",
  "migration-add-avatar.sql",
  "migration-add-contact-status-sector.sql"
]
```

Wtedy `npm run migrate` nie będzie próbował ich uruchomić ponownie.


