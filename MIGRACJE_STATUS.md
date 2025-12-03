# Status migracji

## ✅ Uruchomione automatycznie (4/19):
1. ✅ migration-add-avatar.sql
2. ✅ migration-add-business-model-canvas.sql
3. ✅ migration-add-categories-to-projects.sql
4. ✅ migration-add-contact-status-sector.sql

## ⚠️ Wymagają ręcznego uruchomienia lub SUPABASE_ACCESS_TOKEN (15/19):

Te migracje zawierają `CREATE TABLE`, `CREATE INDEX`, `CREATE POLICY` lub bloki `DO $$`, które wymagają Management API z `SUPABASE_ACCESS_TOKEN`.

### Szybkie rozwiązanie:

**Opcja 1: Dodaj SUPABASE_ACCESS_TOKEN do .env**
- Wejdź do Supabase Dashboard > Account Settings > Access Tokens
- Utwórz nowy token i dodaj do `.env`
- Uruchom ponownie: `npm run migrate`

**Opcja 2: Uruchom ręcznie w Supabase SQL Editor**

Otwórz Supabase Dashboard > SQL Editor i uruchom każdą migrację:

### Najważniejsze migracje do uruchomienia:

1. **migration-add-website-to-contacts.sql** (NOWA - wymagana)
   ```sql
   ALTER TABLE contacts 
   ADD COLUMN IF NOT EXISTS website TEXT;
   ```

2. **migration-add-categories-to-projects.sql**
   ```sql
   ALTER TABLE projects
   ADD COLUMN IF NOT EXISTS categories TEXT[] DEFAULT '{}';
   ```

3. **migration-add-contact-status-sector.sql**
   ```sql
   ALTER TABLE contacts 
   ADD COLUMN IF NOT EXISTS contact_status TEXT CHECK (contact_status IN ('ongoing', 'freezed'));
   
   ALTER TABLE contacts 
   ADD COLUMN IF NOT EXISTS sector TEXT;
   ```

4. **migration-add-location-nationality.sql**
   ```sql
   ALTER TABLE contacts 
   ADD COLUMN IF NOT EXISTS location TEXT;
   
   ALTER TABLE contacts 
   ADD COLUMN IF NOT EXISTS nationality TEXT;
   ```

5. **migration-add-role-to-contacts.sql**
   - Tworzy tabelę `roles` i dodaje kolumnę `role` do `contacts`
   - Zobacz pełny SQL w pliku

6. **migration-add-multiple-organizations-projects-to-contacts.sql**
   ```sql
   ALTER TABLE contacts 
   ADD COLUMN IF NOT EXISTS organizations TEXT[] DEFAULT '{}';
   
   ALTER TABLE contacts 
   ADD COLUMN IF NOT EXISTS projects TEXT[] DEFAULT '{}';
   ```

### Pozostałe migracje:
- migration-add-documents.sql
- migration-add-edit-url.sql
- migration-add-organisations-status-priority.sql
- migration-add-project-type.sql
- migration-add-projects.sql
- migration-add-user-settings.sql
- migration-fix-projects-table.sql
- migration-remove-duplicates.sql
- migration-storage-policies.sql
- migration-update-business-model-canvas-to-organisations.sql
- migration-update-business-model-canvas-to-universal-objects.sql
- migration-update-categories.sql
- migration-update-organisations-status-values.sql

## Po uruchomieniu migracji ręcznie:

Oznacz je jako wykonane w `.migrations-log.json`:
```json
[
  "migration-add-avatar.sql",
  "migration-add-business-model-canvas.sql",
  "migration-add-website-to-contacts.sql",
  "migration-add-categories-to-projects.sql"
]
```

Wtedy `npm run migrate` nie będzie próbował ich uruchomić ponownie.

