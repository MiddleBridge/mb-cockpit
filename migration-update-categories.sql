-- Migration: Update categories to new standard categories
-- This replaces old categories (Strategia, Strategy, etc.) with new standard categories

-- Step 1: Delete old categories (Strategia, Strategy, and any variations)
DELETE FROM categories 
WHERE name IN ('Strategia', 'Strategy', 'strategia', 'strategy');

-- Step 2: Insert new standard categories
-- Only insert if they don't already exist (idempotent)
INSERT INTO categories (name)
SELECT 'Client'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Client');

INSERT INTO categories (name)
SELECT 'Prospect'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Prospect');

INSERT INTO categories (name)
SELECT 'Partner'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Partner');

INSERT INTO categories (name)
SELECT 'Investor'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Investor');

INSERT INTO categories (name)
SELECT 'Government'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Government');

-- Step 3: Update contacts - remove old category references from categories array
UPDATE contacts
SET categories = array_remove(categories, 'Strategia'),
    updated_at = TIMEZONE('utc', NOW())
WHERE 'Strategia' = ANY(categories);

UPDATE contacts
SET categories = array_remove(categories, 'Strategy'),
    updated_at = TIMEZONE('utc', NOW())
WHERE 'Strategy' = ANY(categories);

UPDATE contacts
SET categories = array_remove(categories, 'strategia'),
    updated_at = TIMEZONE('utc', NOW())
WHERE 'strategia' = ANY(categories);

UPDATE contacts
SET categories = array_remove(categories, 'strategy'),
    updated_at = TIMEZONE('utc', NOW())
WHERE 'strategy' = ANY(categories);

-- Step 4: Update organisations - remove old category references from categories array
UPDATE organisations
SET categories = array_remove(categories, 'Strategia'),
    updated_at = TIMEZONE('utc', NOW())
WHERE 'Strategia' = ANY(categories);

UPDATE organisations
SET categories = array_remove(categories, 'Strategy'),
    updated_at = TIMEZONE('utc', NOW())
WHERE 'Strategy' = ANY(categories);

UPDATE organisations
SET categories = array_remove(categories, 'strategia'),
    updated_at = TIMEZONE('utc', NOW())
WHERE 'strategia' = ANY(categories);

UPDATE organisations
SET categories = array_remove(categories, 'strategy'),
    updated_at = TIMEZONE('utc', NOW())
WHERE 'strategy' = ANY(categories);




