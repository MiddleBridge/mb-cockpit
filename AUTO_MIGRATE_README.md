# Automatyczne uruchamianie migracji SQL

## Szybki start

Skrypt `scripts/auto-migrate.js` automatycznie uruchamia migracje SQL w Supabase.

### Wymagania:

1. **Dodaj do `.env`:**
   ```
   SUPABASE_ACCESS_TOKEN=twój_access_token
   ```
   
   Lub użyj `SUPABASE_SERVICE_ROLE_KEY` (jeśli już masz w .env)

2. **Uruchom migrację:**
   ```bash
   npm run migrate
   ```
   
   Lub dla konkretnego pliku:
   ```bash
   node scripts/auto-migrate.js migration-add-website-to-contacts.sql
   ```

## Jak uzyskać klucze?

### SUPABASE_SERVICE_ROLE_KEY (Zalecane - łatwiejsze)

1. Wejdź do Supabase Dashboard: https://app.supabase.com
2. Wybierz swój projekt
3. Settings (⚙️) > API
4. W sekcji **Project API keys** znajdź **`service_role`** key
5. Kliknij ikonę oka 👁️ aby pokazać klucz
6. Skopiuj i dodaj do `.env` jako `SUPABASE_SERVICE_ROLE_KEY`

**⚠️ UWAGA:** To jest sekretny klucz z pełnymi uprawnieniami! NIE commituj go do Git!

### SUPABASE_ACCESS_TOKEN (Alternatywa)

1. Wejdź do Supabase Dashboard
2. Kliknij na swoje konto (prawy górny róg) > Account Settings
3. Access Tokens > Generate new token
4. Skopiuj token do `.env` jako `SUPABASE_ACCESS_TOKEN`

**📖 Szczegółowa instrukcja:** Zobacz `JAK_ZNALEZC_KLUCZE_SUPABASE.md`

## Alternatywa: Użyj SUPABASE_SERVICE_ROLE_KEY

Jeśli masz już `SUPABASE_SERVICE_ROLE_KEY` w `.env`, skrypt użyje go automatycznie.

## Co robi skrypt?

1. ✅ Sprawdza które migracje już zostały uruchomione (zapisuje w `.migrations-log.json`)
2. ✅ Automatycznie uruchamia wszystkie nowe migracje przez Supabase Management API
3. ✅ Oznacza migracje jako wykonane po sukcesie
4. ✅ Pokazuje SQL do ręcznego uruchomienia jeśli API nie działa

## Uwaga

Jeśli Management API nie działa (np. brak uprawnień), skrypt pokaże SQL do ręcznego uruchomienia w Supabase SQL Editor.

