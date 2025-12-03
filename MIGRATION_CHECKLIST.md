# Checklist migracji dla tabeli contacts

## Kolumny w bazie danych (contacts table)

### Podstawowe pola (z supabase-schema.sql):
- ✅ id (UUID, PRIMARY KEY)
- ✅ name (TEXT, NOT NULL)
- ✅ email (TEXT)
- ✅ avatar (TEXT) - wymaga: migration-add-avatar.sql
- ✅ organization (TEXT) - legacy, zachowane dla kompatybilności
- ✅ notes (TEXT)
- ✅ categories (TEXT[])
- ✅ status (TEXT, CHECK)
- ✅ tasks (JSONB)
- ✅ created_at (TIMESTAMP)
- ✅ updated_at (TIMESTAMP)

### Pola dodane przez migracje:
- ✅ organizations (TEXT[]) - wymaga: migration-add-multiple-organizations-projects-to-contacts.sql
- ✅ projects (TEXT[]) - wymaga: migration-add-multiple-organizations-projects-to-contacts.sql
- ✅ contact_status (TEXT) - wymaga: migration-add-contact-status-sector.sql
- ✅ sector (TEXT) - wymaga: migration-add-contact-status-sector.sql
- ✅ location (TEXT) - wymaga: migration-add-location-nationality.sql
- ✅ nationality (TEXT) - wymaga: migration-add-location-nationality.sql
- ✅ role (TEXT) - wymaga: migration-add-role-to-contacts.sql
- ⚠️ website (TEXT) - wymaga: migration-add-website-to-contacts.sql (NOWO UTWORZONA)

## Status integracji z Supabase

### ✅ Zintegrowane i działające:
1. **Podstawowe pola**: name, email, notes, categories, status, tasks
2. **Avatar**: zapisywane przez updateContact
3. **Organizations**: zapisywane jako organizations[] (array)
4. **Projects**: zapisywane jako projects[] (array)
5. **Contact status**: zapisywane jako contact_status
6. **Sector**: zapisywane jako sector
7. **Location**: zapisywane jako location
8. **Nationality**: zapisywane jako nationality
9. **Role**: zapisywane jako role, nowe role dodawane do tabeli roles

### ⚠️ Wymaga migracji:
- **Website**: kolumna nie istnieje w bazie, utworzono migration-add-website-to-contacts.sql

## Funkcje updateInlineField - wszystkie pola obsługiwane:
- ✅ website
- ✅ status
- ✅ role
- ✅ categories
- ✅ location
- ✅ nationality
- ✅ organization (legacy)
- ✅ organizations (nowe, array)
- ✅ name
- ✅ contact_status
- ✅ sector
- ✅ projects
- ✅ avatar

## Dodawanie nowych wartości do list:
- ✅ **Role**: addRole() - zapisuje do tabeli roles
- ✅ **Organizations**: addOrganisation() - zapisuje do tabeli organisations
- ✅ **Sectors**: hardcoded lista, wartości zapisywane w kontakcie
- ✅ **Location/Nationality**: wartości zapisywane w kontakcie (lista krajów hardcoded)

## Instrukcje:
1. Uruchom migration-add-website-to-contacts.sql w Supabase SQL Editor
2. Sprawdź czy wszystkie inne migracje zostały uruchomione
3. Wszystkie pola są teraz poprawnie zmapowane do Supabase



