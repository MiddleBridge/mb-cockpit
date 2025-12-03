@echo off
git add migration-add-documents-links.sql src/app/components/BusinessModelCanvas.tsx src/app/components/ContactsView.tsx src/app/api/image-proxy/route.ts
git commit -m "Add migration for documents links and fix TypeScript errors"
git push
pause

