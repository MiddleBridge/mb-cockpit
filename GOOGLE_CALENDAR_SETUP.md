# Google Calendar Integration Setup

## Overview

Aplikacja może synchronizować zadania z Google Calendar. Zadania z ustawionym `dueDate` mogą być automatycznie tworzone jako wydarzenia w Twoim kalendarzu Google.

## Features

- ✅ Połączenie z Google Calendar
- ✅ Synchronizacja zadań z terminami do kalendarza
- ✅ Automatyczne tworzenie wydarzeń z zadań
- ✅ Aktualizacja wydarzeń przy zmianie zadań
- ✅ Usuwanie wydarzeń przy usuwaniu zadań

## Setup Instructions

### 1. Google Cloud Console Setup

1. **Przejdź do [Google Cloud Console](https://console.cloud.google.com/)**
2. **Utwórz nowy projekt** (lub wybierz istniejący)
3. **Włącz Google Calendar API**:
   - Przejdź do "APIs & Services" → "Library"
   - Wyszukaj "Google Calendar API"
   - Kliknij "Enable"

### 2. Create OAuth 2.0 Credentials

1. **Przejdź do "APIs & Services" → "Credentials"**
2. **Kliknij "Create Credentials" → "OAuth client ID"**
3. **Wybierz "Web application"**
4. **Dodaj Authorized JavaScript origins**:
   - `http://localhost:3000` (dla development)
   - `https://yourdomain.com` (dla production)
5. **Dodaj Authorized redirect URIs**:
   - `http://localhost:3000` (dla development)
   - `https://yourdomain.com` (dla production)
6. **Skopiuj Client ID**

### 3. Environment Variables

Dodaj do pliku `.env`:

```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
NEXT_PUBLIC_GOOGLE_API_KEY=your-api-key-here
```

**Uwaga**: Jeśli już masz `NEXT_PUBLIC_GOOGLE_API_KEY` dla Google Picker (dokumenty), możesz użyć tego samego klucza.

### 4. Usage

1. **Otwórz widok zadań** (Tasks)
2. **Kliknij "Connect Google Calendar"** na górze
3. **Zaloguj się do Google** i zaakceptuj uprawnienia
4. **Dla zadań z terminem (`dueDate`)** pojawi się przycisk "📅 Sync"
5. **Kliknij "📅 Sync"** aby utworzyć wydarzenie w kalendarzu

## How It Works

- **Synchronizacja**: Zadania z `dueDate` są konwertowane na wydarzenia kalendarza
- **Czas trwania**: Domyślnie 1 godzina od `dueDate`
- **Opis**: Zawiera tekst zadania, notatki, przypisanych i kontakt
- **Przypomnienia**: Domyślne przypomnienia Google Calendar
- **Aktualizacja**: Jeśli zadanie ma już `calendar_event_id`, wydarzenie jest aktualizowane zamiast tworzone na nowo

## Troubleshooting

### "Failed to sign in"
- Sprawdź czy `NEXT_PUBLIC_GOOGLE_CLIENT_ID` jest poprawnie ustawione
- Sprawdź czy Google Calendar API jest włączone
- Sprawdź czy domeny są dodane do Authorized origins

### "Failed to sync task to calendar"
- Sprawdź czy jesteś zalogowany do Google Calendar
- Sprawdź czy zadanie ma ustawiony `dueDate`
- Sprawdź konsolę przeglądarki dla szczegółów błędu

## Future Enhancements

Możliwe rozszerzenia:
- Dwukierunkowa synchronizacja (wydarzenia z kalendarza → zadania)
- Automatyczna synchronizacja wszystkich zadań z terminami
- Wyświetlanie wydarzeń z kalendarza w widoku zadań
- Synchronizacja przypisanych (assignees) jako uczestników wydarzenia


