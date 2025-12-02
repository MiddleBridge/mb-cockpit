# Supabase Setup Instructions

## 1. Install Supabase Client

```bash
npm install @supabase/supabase-js
```

## 2. Configure Environment Variables

Create a `.env.local` file in the root directory with your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

You can find these values in your Supabase project settings under API.

## 3. Create Database Tables

Run the SQL script in `supabase-schema.sql` in your Supabase SQL Editor to create the necessary tables:

- `categories` - for storing category names
- `organisations` - for storing organizations with categories
- `contacts` - for storing contacts with tasks, categories, and status

## 4. Verify Setup

After setup, all data (contacts, organisations, categories) will be automatically saved to and loaded from Supabase instead of localStorage.



