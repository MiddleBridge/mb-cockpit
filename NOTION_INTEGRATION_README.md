# Notion Integration for MB Cockpit

This document describes the Notion integration implementation for MB Cockpit, which enables Notion as a notes and knowledge surface while MB Cockpit remains the system of record.

## Architecture Overview

The integration follows a "Pointer + Notes Ingestion" pattern:

- **MB entities** (Contact, Organisation, Project, Document) can have a linked Notion page
- **MB can create** Notion pages inside a dedicated Notion database or data source
- **Notion webhooks** signal changes and MB ingests the latest page content into MB as canonical notes
- **MB UI** surfaces notes, search, and deep links back to Notion

## Database Schema

The integration uses four main tables:

1. **notion_connections** - Stores OAuth tokens and workspace info per user
2. **notion_links** - Pointers from MB entities to Notion pages
3. **entity_notes** - Canonical notes content ingested from Notion (markdown + plaintext)
4. **notion_jobs** - Job queue for syncing pages with rate limiting and retries

See `migration-add-notion-integration.sql` for the complete schema.

## Setup Instructions

### 1. Create Notion Integration

1. Go to https://www.notion.so/my-integrations
2. Click "New integration"
3. Fill in:
   - **Name**: MB Cockpit
   - **Logo**: (optional)
   - **Associated workspace**: Select your workspace
   - **Type**: Public integration (or Internal if only for your workspace)
4. Note the **Integration ID** (this is your `NOTION_CLIENT_ID`)
5. Copy the **Internal Integration Token** (this is your `NOTION_CLIENT_SECRET` for OAuth)

### 2. Configure OAuth Redirect URI

1. In your Notion integration settings, add a redirect URI:
   - Development: `http://localhost:3000/api/notion/oauth/callback`
   - Production: `https://your-domain.com/api/notion/oauth/callback`

### 3. Set Up Notion Database for MB Notes

1. Create a new database in Notion (or use an existing one)
2. Add the following properties to your database:
   - **Name** (Title) - for the page title
   - **MB Entity Type** (Select) - values: contact, organisation, project, document
   - **MB Entity ID** (Text) - stores the MB entity UUID
   - **MB URL** (URL) - deep link back to MB Cockpit
3. Copy the database ID from the URL:
   - URL format: `https://www.notion.so/workspace/DATABASE_ID?v=...`
   - The database ID is the long alphanumeric string

### 4. Environment Variables

Add these to your `.env` file:

```env
# Notion OAuth
NOTION_CLIENT_ID=your_integration_id
NOTION_CLIENT_SECRET=your_internal_integration_token
NOTION_REDIRECT_URI=http://localhost:3000/api/notion/oauth/callback
NOTION_VERSION=2025-09-03

# Encryption (generate a strong random key)
ENCRYPTION_KEY=your_32_character_or_longer_random_key
ENCRYPTION_SALT=mb-cockpit-notion-salt-v1

# App configuration
APP_BASE_URL=http://localhost:3000
NOTION_DEFAULT_DATABASE_ID=your_database_id_here

# Supabase (for service role operations)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**Important**: Generate a strong `ENCRYPTION_KEY`:
```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 5. Run Database Migration

Run the migration in Supabase SQL Editor:

```bash
# Or use the migration script
cat migration-add-notion-integration.sql
```

Copy and paste the contents into Supabase Dashboard → SQL Editor → Run

### 6. Set Up Webhook (Optional but Recommended)

1. After creating a Notion page from MB Cockpit, you'll receive a `verification_token` in the webhook
2. Configure your webhook URL in Notion:
   - Development: `http://localhost:3000/api/notion/webhook` (use ngrok for local testing)
   - Production: `https://your-domain.com/api/notion/webhook`
3. The webhook endpoint will automatically handle verification and store the token

**Note**: For local development, use [ngrok](https://ngrok.com/) to expose your local server:
```bash
ngrok http 3000
# Use the ngrok URL for webhook configuration
```

### 7. Set Up Cron Job for Sync Worker

The sync worker processes jobs from the `notion_jobs` table. Set up a cron job to call it periodically.

#### Vercel Cron (Recommended)

Add to `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/notion/jobs/run",
    "schedule": "*/5 * * * *"
  }]
}
```

#### Manual Cron (Alternative)

Use a service like [cron-job.org](https://cron-job.org/) or your server's cron to call:
```
POST https://your-domain.com/api/notion/jobs/run
Headers: x-service-role-key: YOUR_SERVICE_ROLE_KEY
```

Schedule: Every 1-5 minutes

## Usage

### Connect Notion

1. Navigate to Settings (or wherever you've added the `NotionSettings` component)
2. Click "Connect Notion"
3. Authorize the integration in Notion
4. Configure your database/data source ID

### Create Notes for Entities

1. Open any Contact, Organisation, Project, or Document
2. Find the "Notion Notes" panel
3. Click "Create Notion Note"
4. A new page will be created in your configured Notion database
5. The page will include back-pointers to MB Cockpit

### Sync Notes

- **Automatic**: Webhooks trigger sync jobs when pages are updated in Notion
- **Manual**: Click "Sync Now" in the Notion Notes panel
- **Scheduled**: The cron job processes pending sync jobs every few minutes

### View Notes

- Notes appear in the Notion Notes panel on entity pages
- Search notes using the global notes view (to be implemented)
- Click "Open in Notion" to edit in Notion

## API Endpoints

### OAuth
- `GET /api/notion/oauth/start?userEmail=...` - Start OAuth flow
- `GET /api/notion/oauth/callback` - OAuth callback (handled by Notion)
- `POST /api/notion/oauth/disconnect` - Disconnect integration

### Notes
- `POST /api/notion/create-note` - Create a Notion page for an entity
- `POST /api/notion/sync-now` - Manually trigger a sync

### Webhooks
- `POST /api/notion/webhook` - Notion webhook endpoint

### Jobs
- `POST /api/notion/jobs/run` - Process sync jobs (called by cron)

## Security Considerations

1. **Token Encryption**: All access tokens and verification tokens are encrypted at rest using AES-256-GCM
2. **Webhook Signatures**: All webhook requests are verified using HMAC-SHA256
3. **Row-Level Security**: All tables have RLS enabled (currently permissive, should be restricted in production)
4. **Service Role Key**: The job worker endpoint should be protected with a service role key

## Troubleshooting

### OAuth Connection Fails

- Check that `NOTION_CLIENT_ID` and `NOTION_CLIENT_SECRET` are correct
- Verify redirect URI matches exactly in Notion settings
- Check browser console for errors

### Webhook Not Working

- Verify webhook URL is accessible (use ngrok for local testing)
- Check that signature verification is passing (see logs)
- Ensure `verification_token` is being stored correctly

### Sync Jobs Not Processing

- Check that cron job is running and calling `/api/notion/jobs/run`
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set correctly
- Check `notion_jobs` table for failed jobs and error messages
- Ensure Notion API tokens are valid (not expired/revoked)

### Rate Limiting

- The integration automatically handles 429 responses with exponential backoff
- Jobs are processed sequentially per workspace to respect rate limits
- Adjust `NOTION_MAX_JOBS_PER_RUN` if needed

## Notion API Versioning

The integration uses Notion API version `2025-09-03` by default, which introduces the `data_sources` model. The client automatically handles:

- Databases that have child data sources
- Creating pages under data sources
- Querying data sources

## Limitations

- **No bi-directional sync**: Changes in MB Cockpit don't update Notion (only ingestion from Notion)
- **No task/invoice sync**: Only notes are synced, not tasks, invoices, or transactions
- **No document binary sync**: Only text content is synced, not file attachments
- **Single workspace per user**: Currently supports one Notion workspace per user (can be extended)

## Future Enhancements

- [ ] Multiple workspaces per user
- [ ] Embeddings for semantic search
- [ ] Full-text search across all notes
- [ ] Notes view grouped by entity type
- [ ] Manual link existing Notion pages
- [ ] Support for more block types in markdown conversion

## Assumptions Made

1. **User Identification**: Uses `user_email` (TEXT) instead of `user_id` (UUID) to match existing MB Cockpit pattern
2. **Entity Tables**: Assumes tables `contacts`, `organisations`, `projects`, `documents` exist with `id` (UUID) and `name` (TEXT) columns
3. **No Supabase Auth**: Currently uses simple user_email identification (can be adapted for Supabase Auth if needed)
4. **Single Parent**: One database/data source per user for MB Notes (can be extended to multiple)

## Files Created

- `migration-add-notion-integration.sql` - Database schema
- `src/lib/notion/encryption.ts` - Token encryption helpers
- `src/lib/notion/client.ts` - Notion API client wrapper
- `src/lib/notion/blocksToMarkdown.ts` - Block to markdown converter
- `src/app/api/notion/oauth/*` - OAuth routes
- `src/app/api/notion/webhook/route.ts` - Webhook endpoint
- `src/app/api/notion/create-note/route.ts` - Create note API
- `src/app/api/notion/sync-now/route.ts` - Manual sync API
- `src/app/api/notion/jobs/run/route.ts` - Job worker
- `src/app/components/NotionSettings.tsx` - Settings UI
- `src/app/components/NotionNotesPanel.tsx` - Entity notes panel

## Support

For issues or questions, check:
- Notion API docs: https://developers.notion.com
- Webhook docs: https://developers.notion.com/reference/webhooks
- Rate limits: https://developers.notion.com/reference/request-limits

