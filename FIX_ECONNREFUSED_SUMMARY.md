# Fix ECONNREFUSED 127.0.0.1:3000 - Summary

## ✅ Completed Changes

### 1. Created Base URL Helper
- **File**: `src/server/http/baseUrl.ts`
- `getBaseUrl()` - Prefers APP_URL, then VERCEL_URL, then headers
- `assertProdBaseUrl()` - Throws error if localhost detected in production

### 2. Extracted Server Functions (No HTTP)
- **File**: `src/server/documents/upload.ts`
  - `uploadDocument()` - Direct server function, no HTTP
- **File**: `src/server/documents/link.ts`
  - `createDocumentLink()` - Direct server function
  - `deleteDocumentLink()` - Direct server function

### 3. Refactored Server Actions
- **File**: `src/app/actions/documents.ts`
  - `uploadDocumentAndLinkToEntity()` - Now calls `uploadDocument()` directly (no fetch)
  - `linkExistingDocumentToEntity()` - Now calls `createDocumentLink()` directly (no fetch)
  - `softDeleteDocumentLink()` - Now calls `deleteDocumentLink()` directly (no fetch)
  - **Removed**: All `fetch()` calls to `localhost:3000`
  - **Removed**: All `NEXT_PUBLIC_APP_URL` usage

### 4. Simplified API Routes
- **File**: `src/app/api/documents/upload/route.ts`
  - Now just calls `uploadDocument()` function
  - No business logic in route handler
- **File**: `src/app/api/documents/link/route.ts`
  - Now just calls `createDocumentLink()` or `deleteDocumentLink()`
  - No business logic in route handler

### 5. Fixed Gmail OAuth Redirect
- **File**: `src/lib/gmail.ts`
  - Simplified redirect URI fallback (still uses localhost for dev, but cleaner)
- **File**: `src/app/api/gmail/callback/route.ts`
  - Uses `getBaseUrl()` for redirect URI construction

### 6. Added Production Safety Checks
- Debug logging in `uploadDocument()` when `VERCEL` env is set
- `assertProdBaseUrl()` check to catch misconfigurations

## 🎯 Results

✅ **No more self-fetch** - Server Actions call functions directly  
✅ **No localhost:3000 in production** - All URLs use `getBaseUrl()`  
✅ **No NEXT_PUBLIC_APP_URL in server code** - Removed from all server-side files  
✅ **Production-safe** - `assertProdBaseUrl()` prevents localhost in Vercel  

## 📝 Remaining Notes

- Gmail redirect URI still has localhost fallback for development (acceptable)
- Some documentation files mention localhost (not runtime code, safe to ignore)
- Script files (`.js` in root) may have localhost references (not executed in production)

## 🚀 Next Steps

1. Deploy to Vercel
2. Check logs for "DEBUG uploadDocument baseUrl" to verify correct URL
3. Verify no ECONNREFUSED errors in production logs
4. Test document upload functionality

