# Fix placeholder-org-id UUID Error - Summary

## ✅ Problem Solved

**Error**: `Postgres 22P02 invalid input syntax for type uuid: "placeholder-org-id"`

**Root Cause**: `FinanceView.tsx` was using hardcoded `'placeholder-org-id'` string instead of real UUID from database.

## ✅ Changes Made

### 1. Created UUID Validator
- **File**: `src/server/validators/isUuid.ts`
- Validates UUID v4 format before database queries

### 2. Created Org ID Helper
- **File**: `src/server/org/getActiveOrgId.ts`
- `getActiveOrgIdOrThrow()` - Gets first available organisation from DB
- `validateOrgId()` - Validates UUID format
- Strategy: Use provided orgId if valid UUID, otherwise fetch first org from DB

### 3. Refactored Upload Function
- **File**: `src/server/documents/upload.ts`
- Changed return type to `{ ok: true; data: ... } | { ok: false; error: ... }`
- All errors return `{ ok: false }` instead of throwing
- Validates orgId UUID before any database query
- Uses `getActiveOrgIdOrThrow()` to resolve orgId

### 4. Refactored Link Functions
- **File**: `src/server/documents/link.ts`
- `createDocumentLink()` - Now validates orgId UUID
- `deleteDocumentLink()` - Now validates orgId UUID
- Uses `getActiveOrgIdOrThrow()` to resolve orgId

### 5. Updated Server Actions
- **File**: `src/app/actions/documents.ts`
- `uploadDocumentAndLinkToEntity()` - Accepts `orgId: string | null | undefined`
- Throws user-friendly error messages
- All functions now handle null orgId gracefully

### 6. Updated API Routes
- **File**: `src/app/api/documents/upload/route.ts`
- Handles `{ ok: false }` responses properly
- Returns appropriate HTTP status codes

### 7. Fixed FinanceView UI
- **File**: `src/app/components/FinanceView.tsx`
- Removed `'placeholder-org-id'` hardcoded value
- Passes `null` as orgId (resolved server-side)
- Checks if organisations exist before allowing upload
- Shows helpful message when no organisations exist
- Better error messages for org-related errors

### 8. Updated Components
- **File**: `src/components/finance/TransactionDrawerDocuments.tsx`
- Better error handling with org-related messages
- **File**: `src/components/documents/DocumentLinksPanel.tsx`
- Better error handling with org-related messages

## 🎯 Results

✅ **No more placeholder-org-id** - All removed from runtime code  
✅ **UUID validation** - All orgId values validated before DB queries  
✅ **Graceful error handling** - Returns `{ ok: false }` instead of crashing SSR  
✅ **UI protection** - Upload blocked when no organisations exist  
✅ **User-friendly messages** - Clear error messages in Polish  

## 📝 How It Works Now

1. **User tries to upload** → `FinanceView` passes `null` as orgId
2. **Server action** → Calls `uploadDocument()` with `orgId: null`
3. **Server function** → `getActiveOrgIdOrThrow(null)` fetches first org from DB
4. **UUID validation** → `isUuid()` validates before any DB query
5. **If no org exists** → Returns `{ ok: false, error: { code: 'ORG_REQUIRED' } }`
6. **UI shows message** → "Najpierw utwórz organizację w sekcji 'Organisations'"

## 🚀 Next Steps

1. Deploy to production
2. Verify no more UUID errors in logs
3. Test upload with and without organisations
4. Verify error messages are user-friendly

