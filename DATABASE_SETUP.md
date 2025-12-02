# Database Setup Instructions

## Quick Setup

1. **Open Supabase Dashboard**: https://supabase.com/dashboard
2. **Select your project** (the same one as MB 2.0)
3. **Go to SQL Editor** (left sidebar)
4. **Copy and paste** the entire contents of `supabase-schema.sql`
5. **Click "Run"** button

## What the schema creates:

- **categories** table - for storing category names
- **organisations** table - for storing organizations with categories
- **contacts** table - for storing contacts with tasks, categories, and status

## After running the SQL:

The application will automatically:
- Save contacts to Supabase
- Save organisations to Supabase  
- Save categories to Supabase
- Load all data from Supabase on page load

## Verify tables were created:

In Supabase Dashboard:
1. Go to **Table Editor** (left sidebar)
2. You should see: `categories`, `organisations`, `contacts`

