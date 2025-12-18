-- Fix gmail_credentials table to allow NULL refresh_token (for frontend OAuth)
-- Frontend OAuth (Google Identity Services) doesn't provide refresh_token

-- Make refresh_token nullable
ALTER TABLE gmail_credentials 
ALTER COLUMN refresh_token DROP NOT NULL;

-- Optional: Update existing rows with empty refresh_token to NULL
UPDATE gmail_credentials 
SET refresh_token = NULL 
WHERE refresh_token = '';

