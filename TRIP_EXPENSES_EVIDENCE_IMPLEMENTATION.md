# Trip Expenses + Evidence + Reimbursement Implementation

This document describes the implementation of the trip expenses, evidence tracking, and reimbursement flow.

## Overview

Each Trip is a Project. The implementation adds:
- Notes (free text) for trips
- Expense log (transactions filtered by project)
- Evidence library (files linked to notes and transactions)
- Reimbursement summary (totals grouped by currency)

## Database Migration

### 1. Run the migration

Execute `migration-add-trip-expenses-evidence.sql` in Supabase SQL Editor:

```sql
-- Adds to finance_transactions:
-- - project_id (nullable, FK to projects)
-- - paid_by_company_card (boolean, default false)
-- - exclude_from_reimbursement (boolean, default false)

-- Creates tables:
-- - evidence (file metadata)
-- - evidence_links (polymorphic links to transaction/note/project)
```

### 2. Create Storage Bucket

1. Go to Supabase Dashboard → Storage
2. Click "New bucket"
3. Name: `evidence`
4. Make it **PRIVATE** (important: we use signed URLs, not public URLs)
5. Click "Create bucket"

### 3. Set up Storage Policies

Run `migration-storage-evidence-bucket.sql` to create RLS policies for the evidence bucket.

## Features

### 1. Transaction Reimbursement Toggles

**In Finance → Transactions list:**
- Outbound transactions show "To reimburse: X" if reimbursable
- One-click toggle: "Paid by company card" (sets reimbursement to 0)
- Toggle appears in the Reimbursement column

**In Transaction Drawer:**
- "Paid by company card" toggle (primary)
- "Exclude from reimbursement" toggle (secondary, for edge cases)
- Shows "To reimburse: X" badge when amount > 0
- Evidence section (if transaction has project_id)

### 2. Evidence Management

**EvidenceUploader Component:**
- Drag & drop files
- Click to browse
- Paste from clipboard (Ctrl+V) for screenshots
- Supports: PDF, images, documents

**EvidenceGallery Component:**
- Shows thumbnails for images
- Shows file chips for other types
- Click to open (via signed URL)
- Delete button

**Evidence Links:**
- Can be linked to:
  - Transactions (via transaction_id)
  - Notes (via timeline_item_id)
  - Projects (automatic, via project_id)

### 3. Trip Project View

Access via Projects → Click on a project (Trip).

**Tabs:**
1. **Overview**: Notes with evidence attachments
2. **Expenses**: List of transactions for this project
3. **Evidence**: All evidence files for the project
4. **Reimbursement**: Summary with totals grouped by currency

**Notes:**
- Create/edit/delete notes
- Attach evidence to notes
- Notes are stored as timeline_items (type='note')

### 4. Reimbursement Summary

**ReimbursementSummary Component:**
- Shows reimbursable transactions only
- Groups by currency
- Shows line items: vendor + date + amount + currency + category
- Calculates totals per currency

**Reimbursement Logic:**
- Only outbound transactions (`direction='out'`)
- Excludes if `paid_by_company_card=true`
- Excludes if `exclude_from_reimbursement=true`
- Amount = absolute value of transaction amount

## API Endpoints

### `/api/evidence/upload`
Upload evidence file and create record.

**Request:**
- Method: POST
- Body: FormData
  - `file`: File
  - `orgId`: string
  - `projectId`: string
  - `linkType`: 'transaction' | 'note' (optional)
  - `linkId`: string (optional)

**Response:**
```json
{
  "success": true,
  "evidence": {
    "id": "...",
    "storage_path": "org/{orgId}/projects/{projectId}/evidence/{yyyy}/{mm}/{evidenceId}-{filename}",
    ...
  }
}
```

### `/api/evidence/signed-url?path={storagePath}`
Get signed URL for evidence file.

**Response:**
```json
{
  "url": "https://...",
  "expiresIn": 3600
}
```

## Server Actions

### `updateTransactionReimbursement`
Update reimbursement flags for a transaction.

```typescript
await updateTransactionReimbursement({
  transactionId: string,
  paidByCompanyCard?: boolean,
  excludeFromReimbursement?: boolean,
  projectId?: string | null,
});
```

## Components

### EvidenceUploader
```tsx
<EvidenceUploader
  orgId={string}
  projectId={string}
  linkType?: 'transaction' | 'note'
  linkId?: string
  onUploadSuccess?: (evidence: EvidenceWithLinks) => void
  onUploadError?: (error: string) => void
/>
```

### EvidenceGallery
```tsx
<EvidenceGallery
  orgId={string}
  projectId?: string
  transactionId?: string
  noteId?: string
  onDelete?: (evidenceId: string) => void
/>
```

### ReimbursementSummary
```tsx
<ReimbursementSummary
  transactions={Transaction[]}
/>
```

### TripProjectView
```tsx
<TripProjectView
  projectId={string}
  onClose?: () => void
/>
```

## Database Schema

### finance_transactions
- `project_id` UUID (nullable, FK to projects)
- `paid_by_company_card` BOOLEAN (default false)
- `exclude_from_reimbursement` BOOLEAN (default false)

### evidence
- `id` UUID
- `org_id` UUID (FK to organisations)
- `project_id` UUID (FK to projects)
- `file_name` TEXT
- `storage_path` TEXT
- `mime_type` TEXT
- `file_size` BIGINT
- `uploaded_by` UUID
- `created_at` TIMESTAMPTZ

### evidence_links
- `id` UUID
- `evidence_id` UUID (FK to evidence)
- `link_type` TEXT ('transaction' | 'note' | 'project')
- `link_id` UUID
- `created_at` TIMESTAMPTZ
- UNIQUE(evidence_id, link_type, link_id)

## File Storage Structure

Files are stored in Supabase Storage bucket `evidence` with the following path structure:

```
org/{orgId}/projects/{projectId}/evidence/{yyyy}/{mm}/{evidenceId}-{filename}
```

Example:
```
org/abc123/projects/def456/evidence/2024/03/ghi789-receipt.jpg
```

## Security

- **RLS Policies**: All tables have RLS enabled
- **Storage Bucket**: Private bucket, accessed via signed URLs
- **Signed URLs**: Valid for 1 hour
- **Organization Scoping**: Evidence files are scoped to organizations

## Testing Checklist

### Manual Testing

- [ ] Run database migration
- [ ] Create storage bucket `evidence` (private)
- [ ] Run storage policies migration
- [ ] Create a project (trip)
- [ ] Assign transactions to project (via project_id)
- [ ] Toggle "Paid by company card" on a transaction
- [ ] Verify reimbursement amount updates
- [ ] Upload evidence via drag & drop
- [ ] Upload evidence via paste (Ctrl+V)
- [ ] Upload evidence via file picker
- [ ] View evidence thumbnails
- [ ] Delete evidence
- [ ] Link evidence to transaction
- [ ] Link evidence to note
- [ ] View reimbursement summary
- [ ] Verify currency grouping in reimbursement summary
- [ ] Test with multiple currencies
- [ ] Verify signed URLs work and expire correctly

### Edge Cases

- [ ] Transaction with paid_by_company_card=true should show 0 reimbursement
- [ ] Transaction with exclude_from_reimbursement=true should show 0 reimbursement
- [ ] Inbound transactions should show 0 reimbursement
- [ ] Project with no transactions shows empty expense list
- [ ] Project with no evidence shows empty evidence gallery
- [ ] Deleting evidence removes links
- [ ] Signed URLs expire after 1 hour

## Notes

- Notes use the existing `timeline_items` table (type='note')
- Evidence files use signed URLs for security (private bucket)
- Reimbursement totals update instantly when toggling flags
- Currency grouping supports multiple currencies per trip
- Evidence can be linked to multiple entities (transaction + note)

