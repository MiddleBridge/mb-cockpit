@echo off
chcp 65001 >nul
git add src/app/components/FinanceView.tsx
git add src/app/components/Navigation.tsx
git add src/app/components/SegmentContent.tsx
git add src/app/api/documents/upload/route.ts
git commit -m "Add Finance view with bank statement upload and fix TypeScript error in upload route"
git push
pause

