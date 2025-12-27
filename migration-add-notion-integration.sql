-- Migration: Create Notion integration tables
-- This enables Notion as a notes and knowledge surface for MB Cockpit entities
-- Run this in Supabase SQL Editor

-- 1. Create notion_connections table
CREATE TABLE IF NOT EXISTS notion_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  workspace_name TEXT,
  access_token_enc TEXT NOT NULL,
  refresh_token_enc TEXT,
  token_type TEXT,
  scope TEXT,
  notion_bot_id TEXT,
  notion_owner_id TEXT,
  notion_parent_id TEXT,
  notion_parent_type TEXT CHECK (notion_parent_type IN ('database','data_source')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_email, workspace_id)
);

-- 2. Create notion_links table (pointer to Notion pages)
CREATE TABLE IF NOT EXISTS notion_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  mb_entity_type TEXT NOT NULL CHECK (mb_entity_type IN ('contact','organisation','project','document')),
  mb_entity_id UUID NOT NULL,
  notion_page_id TEXT NOT NULL,
  notion_url TEXT NOT NULL,
  notion_parent_type TEXT NOT NULL CHECK (notion_parent_type IN ('database','data_source')),
  notion_parent_id TEXT NOT NULL,
  subscription_id TEXT,
  verification_token_enc TEXT,
  last_synced_at TIMESTAMPTZ,
  last_seen_event_id TEXT,
  content_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_email, mb_entity_type, mb_entity_id)
);

-- 3. Create entity_notes table (canonical notes ingested from Notion)
CREATE TABLE IF NOT EXISTS entity_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  mb_entity_type TEXT NOT NULL,
  mb_entity_id UUID NOT NULL,
  source TEXT NOT NULL DEFAULT 'notion',
  title TEXT,
  content_markdown TEXT NOT NULL,
  content_text TEXT NOT NULL,
  notion_page_id TEXT NOT NULL,
  notion_last_edited_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_email, notion_page_id)
);

-- 4. Create notion_jobs table (simple queue for syncing pages)
CREATE TABLE IF NOT EXISTS notion_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  job_type TEXT NOT NULL CHECK (job_type IN ('sync_page')),
  notion_page_id TEXT NOT NULL,
  mb_entity_type TEXT,
  mb_entity_id UUID,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','retry','done','failed')),
  attempts INT NOT NULL DEFAULT 0,
  next_run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE notion_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE notion_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notion_jobs ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS policies
-- Note: These allow all operations for now. In production, restrict based on user_email matching authenticated user.
-- For server-side operations, use service role key and enforce user_email scoping at application layer.

DROP POLICY IF EXISTS "Allow all operations on notion_connections" ON notion_connections;
CREATE POLICY "Allow all operations on notion_connections" ON notion_connections FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations on notion_links" ON notion_links;
CREATE POLICY "Allow all operations on notion_links" ON notion_links FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations on entity_notes" ON entity_notes;
CREATE POLICY "Allow all operations on entity_notes" ON entity_notes FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations on notion_jobs" ON notion_jobs;
CREATE POLICY "Allow all operations on notion_jobs" ON notion_jobs FOR ALL USING (true);

-- 7. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notion_connections_user_email ON notion_connections(user_email);
CREATE INDEX IF NOT EXISTS idx_notion_connections_workspace_id ON notion_connections(workspace_id);

CREATE INDEX IF NOT EXISTS idx_notion_links_user_email ON notion_links(user_email);
CREATE INDEX IF NOT EXISTS idx_notion_links_mb_entity ON notion_links(user_email, mb_entity_type, mb_entity_id);
CREATE INDEX IF NOT EXISTS idx_notion_links_notion_page_id ON notion_links(user_email, notion_page_id);

CREATE INDEX IF NOT EXISTS idx_entity_notes_user_email ON entity_notes(user_email);
CREATE INDEX IF NOT EXISTS idx_entity_notes_mb_entity ON entity_notes(user_email, mb_entity_type, mb_entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_notes_notion_page_id ON entity_notes(user_email, notion_page_id);
CREATE INDEX IF NOT EXISTS idx_entity_notes_source ON entity_notes(source);

CREATE INDEX IF NOT EXISTS idx_notion_jobs_status_next_run ON notion_jobs(status, next_run_at);
CREATE INDEX IF NOT EXISTS idx_notion_jobs_user_email ON notion_jobs(user_email);
CREATE INDEX IF NOT EXISTS idx_notion_jobs_notion_page_id ON notion_jobs(user_email, notion_page_id);

-- 8. Create trigger to update updated_at automatically
CREATE OR REPLACE FUNCTION update_notion_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_notion_connections_updated_at
  BEFORE UPDATE ON notion_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_notion_updated_at();

CREATE TRIGGER update_notion_links_updated_at
  BEFORE UPDATE ON notion_links
  FOR EACH ROW
  EXECUTE FUNCTION update_notion_updated_at();

CREATE TRIGGER update_entity_notes_updated_at
  BEFORE UPDATE ON entity_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_notion_updated_at();

CREATE TRIGGER update_notion_jobs_updated_at
  BEFORE UPDATE ON notion_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_notion_updated_at();

-- 9. Create encryption helper functions
-- These functions use pgcrypto for encryption at rest
-- ENCRYPTION_KEY should be set as an environment variable and passed to the database
-- For security, consider using Supabase Vault or pgsodium if available

-- Note: Encryption functions require the pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Helper function to encrypt strings (uses ENCRYPTION_KEY from env via application layer)
-- This is a placeholder - actual encryption should be done in application code
-- to avoid exposing the key in database functions
-- For now, we'll handle encryption in the application layer using Node.js crypto

-- Optional: Create audit table for observability
CREATE TABLE IF NOT EXISTS notion_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('oauth_connected', 'oauth_disconnected', 'page_created', 'page_linked', 'webhook_received', 'sync_success', 'sync_failed')),
  notion_page_id TEXT,
  mb_entity_type TEXT,
  mb_entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notion_audit_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations on notion_audit_events" ON notion_audit_events;
CREATE POLICY "Allow all operations on notion_audit_events" ON notion_audit_events FOR ALL USING (true);

CREATE INDEX IF NOT EXISTS idx_notion_audit_events_user_email ON notion_audit_events(user_email);
CREATE INDEX IF NOT EXISTS idx_notion_audit_events_event_type ON notion_audit_events(event_type);
CREATE INDEX IF NOT EXISTS idx_notion_audit_events_created_at ON notion_audit_events(created_at);

