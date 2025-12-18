# Documents ↔ Finance Transactions Linking - Implementation Summary

This document summarizes the implementation of the document linking feature for finance transactions.

## ✅ Completed Implementation

### 1. Database Migration
- **File**: `migration-documents-finance-links.sql`
- Adapts existing `documents` table to new structure:
  - Adds `title`, `doc_type`, `storage_path`, `sha256`, `mime_type`, `file_name`, `metadata`, `created_by`
  - Migrates existing data from old columns to new structure
  - Adds unique constraint on `(organisation_id, sha256)` for idempotent uploads
  - Adds indexes for performance
- Creates `document_links` junction table:
  - Links documents to multiple entity types (FINANCE_TRANSACTION, INVOICE, DEAL, etc.)
  - Supports soft delete with `is_deleted` flag
  - Includes role field (PRIMARY, SOURCE, SUPPORTING, etc.)
  - Proper indexes for fast queries
- Creates convenience view `v_finance_transaction_documents`
- Implements Row Level Security (RLS) policies (basic structure - needs org membership integration)

### 2. API Routes (Next.js)
Since this is a Next.js project, the functionality is implemented as API routes instead of Supabase Edge Functions:

- **`/api/documents/upload`** (`src/app/api/documents/upload/route.ts`)
  - Idempotent document upload
  - Computes SHA256 hash
  - Checks for existing documents by (orgId, sha256)
  - Uploads to Supabase Storage with path convention: `documents/{orgId}/{year}/{month}/{uuid}-{filename}`
  - Optionally creates document_link on upload

- **`/api/documents/link`** (`src/app/api/documents/link/route.ts`)
  - Create link: Links existing document to entity
  - Delete link: Soft deletes link (sets `is_deleted = true`)

### 3. Server Actions
- **`src/app/actions/documents.ts`**
  - `uploadDocumentAndLinkToEntity()` - Upload and link in one call
  - `linkExistingDocumentToEntity()` - Link existing document
  - `softDeleteDocumentLink()` - Remove link
  - `searchDocuments()` - Search by title, filename, or metadata
  - `getDocumentById()` - Get single document
  - `getDocumentLinks()` - Get all links for a document

- **`src/app/actions/financeDocuments.ts`**
  - `listTransactionDocuments()` - List documents for a transaction
  - `suggestTransactionDocuments()` - Get document suggestions

### 4. Data Access Functions
- **`src/server/finance/documents/transactionDocuments.ts`**
  - `listTransactionDocuments()` - Query documents linked to transaction
  - `createTransactionDocumentLink()` - Create link
  - `removeTransactionDocumentLink()` - Soft delete link

- **`src/server/finance/documents/suggest.ts`**
  - `suggestDocumentsForTransaction()` - Heuristic matching engine
  - Scoring algorithm:
    - +0.40: Invoice number match in reference/description
    - +0.25: Issuer name matches counterparty
    - +0.20: Amount match within tolerance
    - +0.10: Date proximity (issue_date or due_date)
    - +0.05: Currency match
  - Returns top 10 suggestions with score >= 0.55
  - Confidence levels: high (>=0.80), medium (>=0.70), low (>=0.55)

### 5. UI Components
- **`src/components/finance/TransactionDrawerDocuments.tsx`**
  - Section header with "Attach" button
  - List of attached documents with actions (open, detach, set primary)
  - Attach dialog with two tabs:
    - Upload: File upload with progress
    - Link existing: Search and link existing documents
  - Suggestions block (collapsible):
    - Shows suggested documents with reason and confidence
    - One-click "Link" button

- **`src/components/documents/DocumentLinksPanel.tsx`**
  - Shows all entities linked to a document
  - Displays entity type, role, creation date
  - Allows detaching links

## 📋 Usage

### In Transaction Drawer
```tsx
import TransactionDrawerDocuments from '@/components/finance/TransactionDrawerDocuments';

<TransactionDrawerDocuments
  orgId={orgId}
  transactionId={transactionId}
  transaction={{
    booking_date: '2025-01-15',
    amount: 1000.00,
    currency: 'PLN',
    direction: 'OUT',
    counterparty_name: 'Supplier ABC',
    reference: 'INV-2025-001',
    description: 'Invoice payment',
  }}
/>
```

### In Document Detail Page
```tsx
import DocumentLinksPanel from '@/components/documents/DocumentLinksPanel';

<DocumentLinksPanel
  documentId={documentId}
  orgId={orgId}
/>
```

## 🔧 Configuration

### Storage Bucket
Ensure Supabase Storage bucket `documents` exists:
- Path convention: `documents/{orgId}/{year}/{month}/{uuid}-{sanitized_filename}`
- Should be configured with appropriate RLS policies

### Environment Variables
- `NEXT_PUBLIC_APP_URL` - Base URL for API calls (defaults to `http://localhost:3000`)

## 🚀 Next Steps

1. **Run Migration**: Execute `migration-documents-finance-links.sql` in Supabase SQL Editor

2. **Create Storage Bucket**: 
   - Create `documents` bucket in Supabase Storage
   - Configure RLS policies (see `migration-storage-policies.sql` for reference)

3. **Integrate RLS**: 
   - Update RLS policies to check org membership via `auth.uid()` and `org_memberships` table
   - Currently uses permissive policies for development

4. **Add to Transaction Drawer**: 
   - Import and add `TransactionDrawerDocuments` component to your transaction detail drawer

5. **Add to Document Detail**: 
   - Import and add `DocumentLinksPanel` component to your document detail page

6. **Optional Auto-linking**: 
   - The suggestion engine is ready
   - Auto-linking can be enabled for high-confidence matches (score >= 0.90) with BANK_CONFIRMATION type

## 📝 Notes

- The implementation uses `organisation_id` instead of `org_id` to match existing codebase conventions
- Documents are deduplicated by SHA256 hash per organisation
- Links use soft delete to maintain audit trail
- All queries are org-scoped and protected by RLS (once properly configured)
- The suggestion engine is conservative (threshold 0.55) to preserve user trust

## 🐛 Known Limitations

- RLS policies currently use permissive `true` checks - needs org membership integration
- `created_by` field allows NULL for backward compatibility - should be populated from auth context
- Entity navigation URLs in `DocumentLinksPanel` are placeholders - implement based on your routing
- "Set primary" role functionality is stubbed - needs implementation

