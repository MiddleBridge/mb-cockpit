@echo off
chcp 65001 >nul
git add src/server/http/baseUrl.ts
git add src/server/documents/upload.ts
git add src/server/documents/link.ts
git add src/app/api/documents/upload/route.ts
git add src/app/api/documents/link/route.ts
git add src/app/actions/documents.ts
git add src/lib/gmail.ts
git add src/app/api/gmail/callback/route.ts
git add src/app/components/FinanceView.tsx
git add src/app/components/Navigation.tsx
git add src/app/components/SegmentContent.tsx
git add FIX_ECONNREFUSED_SUMMARY.md
git commit -m "Fix ECONNREFUSED 127.0.0.1:3000 in production

- Add baseUrl helper with APP_URL/VERCEL_URL support
- Extract server functions (upload, link) to avoid self-fetch
- Refactor Server Actions to call functions directly (no HTTP)
- Remove all localhost:3000 and NEXT_PUBLIC_APP_URL from server code
- Add production safety checks with assertProdBaseUrl
- Add Finance view with bank statement upload
- Fix Gmail OAuth redirect URI to use getBaseUrl"
git push
pause

