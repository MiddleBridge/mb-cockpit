# Trips V2 Implementation - Discovery & Implementation Log

## Discovery Results

### 1. Component Structure
- **Main View**: `src/features/finance-trips/components/FinanceTripsView.tsx`
- **Detail View**: `src/features/finance-trips/components/TripDetailView.tsx`
- **Route**: Finance → Trips segment (via Navigation.tsx → SegmentContent.tsx)
- **Integration**: `src/app/components/SegmentContent.tsx` imports `FinanceTripsView`

### 2. Database Schema
- **Trips table**: `finance_trips`
  - Fields: id, org_id, title, start_date, end_date, status, created_at, updated_at
  - Location: `src/features/finance-trips/db/trips.ts`
  
- **Trip Items (Expenses)**: `finance_trip_items`
  - Fields: id, org_id, trip_id, source, transaction_id, item_date, vendor, description, category, amount, currency, paid_by_company_card, exclude_from_reimbursement, created_at
  - Location: `src/features/finance-trips/db/trip-items.ts`
  - Functions: getTripItems, createTripItem, updateTripItem, deleteTripItem, getUsedTransactionIds

- **Trip Evidence**: `finance_trip_evidence`
  - Currently exists for attachments
  - Fields: id, org_id, trip_id, trip_item_id, file_name, mime_type, file_size, storage_bucket, storage_path, created_at
  - Location: `src/features/finance-trips/db/trip-evidence.ts`

### 3. Current UI Structure
- TripDetailView has:
  - Header with title/date/status
  - Quick Add form (multi-field row)
  - Expense table with many columns
  - Right sidebar with: Reimbursement Summary, Missing Evidence, Notes
  - Add from Transactions modal

### 4. Date Formatting
- Uses `date-fns` library (format function imported)
- Current display: `format(new Date(dateStr), "dd.MM.yyyy")` (already EU format!)
- But placeholders may show "mm/dd/yyyy"
- Location: Used in TripDetailView.tsx, FinanceTripsView.tsx

### 5. Storage
- Current bucket: `trip-evidence` (private)
- Upload API: `src/app/api/trip-evidence/upload/route.ts`
- Signed URL API: `src/app/api/trip-evidence/signed-url/route.ts`
- Path pattern: `org/{orgId}/trips/{tripId}/{yyyy}/{mm}/{evidenceId}-{filename}`

### 6. Organisation Context
- Uses `useOrganisations` hook from `src/app/hooks/useSharedLists.ts`
- Selected org via state management in FinanceTripsView

## Implementation Plan

### Step 1: Data Model Changes
- Add `card_source TEXT NULL` to `finance_trip_items`
- Reuse `finance_trip_evidence` for attachments (already has trip_item_id link)
- Or create new `expense_attachments` table if cleaner separation needed
- Update types in `src/features/finance-trips/db/trips.ts`

### Step 2: UI Layout Rework
- Remove multi-field Quick Add form
- Single input with parser
- Simplify expense table columns
- Remove reimbursement/missing evidence panels from main view
- Add slide-over drawer for expense detail

### Step 3: Quick Add Parser
- Create `src/lib/trips/parseQuickAdd.ts`
- Parse amount, currency, category, vendor/description from single line
- Handle EU number formats (comma/space separators)

### Step 4: European Date Format
- Search and replace all "mm/dd/yyyy" placeholders
- Ensure all dates use `format(date, 'dd.MM.yyyy')`
- Update CSV export dates

### Step 5: Card Source Field
- Add dropdown to expense rows
- Update create/update functions
- Add to types

### Step 6: Attachments UX
- Use existing trip_evidence system or create new table
- Add paperclip icon to rows
- Implement drag & drop
- Show in drawer

### Step 7: Cleanup
- Remove reimbursement summary from main view
- Remove missing evidence from main view
- Move notes to drawer (optional)

### Step 8: Performance
- Auto-focus input
- Keyboard shortcuts
- Optimistic updates

## Files to Modify

1. `src/features/finance-trips/db/trips.ts` - Add card_source to FinanceTripItem type
2. `src/features/finance-trips/components/TripDetailView.tsx` - Major UI rework
3. `src/features/finance-trips/db/trip-items.ts` - Update functions for card_source
4. `migration-add-card-source-to-trip-items.sql` - New migration
5. `src/lib/trips/parseQuickAdd.ts` - New parser utility
6. Update all date placeholders and formatting

