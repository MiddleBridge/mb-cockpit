# Jak znaleźć klucze Supabase do automatycznych migracji

## SUPABASE_SERVICE_ROLE_KEY (Zalecane - łatwiejsze)

### Krok 1: Wejdź do Supabase Dashboard
1. Otwórz https://app.supabase.com
2. Zaloguj się do swojego konta
3. Wybierz swój projekt

### Krok 2: Przejdź do ustawień API
1. W lewym menu kliknij **Settings** (⚙️)
2. Kliknij **API** w podmenu

### Krok 3: Znajdź Service Role Key
1. Przewiń do sekcji **Project API keys**
2. Znajdź **`service_role`** key (⚠️ UWAGA: To jest sekretny klucz!)
3. Kliknij ikonę oka 👁️ aby pokazać klucz
4. Skopiuj cały klucz (zaczyna się od `eyJ...`)

### Krok 4: Dodaj do .env
Otwórz plik `.env` w głównym katalogu projektu i dodaj:
```env
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**⚠️ WAŻNE:** 
- **NIGDY** nie commituj tego klucza do Git!
- Ten klucz ma pełne uprawnienia do bazy danych
- Używaj go tylko lokalnie lub w bezpiecznym środowisku

---

## SUPABASE_ACCESS_TOKEN (Alternatywa)

### Krok 1: Wejdź do Supabase Dashboard
1. Otwórz https://app.supabase.com
2. Zaloguj się do swojego konta

### Krok 2: Przejdź do Access Tokens
1. Kliknij na swoje **konto** (prawy górny róg)
2. Wybierz **Account Settings**
3. W lewym menu kliknij **Access Tokens**

### Krok 3: Utwórz nowy token
1. Kliknij **Generate new token**
2. Nadaj mu nazwę (np. "Auto Migrations")
3. Skopiuj wygenerowany token

### Krok 4: Dodaj do .env
Otwórz plik `.env` w głównym katalogu projektu i dodaj:
```env
SUPABASE_ACCESS_TOKEN=your_access_token_here
```

---

## Który klucz wybrać?

### ✅ SUPABASE_SERVICE_ROLE_KEY (Zalecane)
- **Prostsze** - już masz go w projekcie (jeśli używasz Supabase)
- **Szybsze** - nie trzeba tworzyć nowego tokena
- **Wystarczające** - ma wszystkie potrzebne uprawnienia

### SUPABASE_ACCESS_TOKEN
- Używaj tylko jeśli nie masz Service Role Key
- Wymaga utworzenia nowego tokena w ustawieniach konta

---

## Sprawdź czy masz już klucze

Sprawdź czy masz plik `.env` w głównym katalogu projektu. Jeśli tak, otwórz go i sprawdź czy masz:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` ← **Ten jest potrzebny do migracji**

Jeśli masz `SUPABASE_SERVICE_ROLE_KEY`, możesz od razu uruchomić:
```bash
npm run migrate
```

---

## Przykładowy plik .env

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Opcjonalnie (jeśli nie masz Service Role Key):
# SUPABASE_ACCESS_TOKEN=your_access_token_here
```

---

## Po dodaniu klucza

Uruchom migracje:
```bash
npm run migrate
```

Skrypt automatycznie:
1. ✅ Sprawdzi które migracje już zostały uruchomione
2. ✅ Uruchomi wszystkie nowe migracje (w tym `migration-add-website-to-contacts.sql`)
3. ✅ Zapisze log wykonanych migracji



