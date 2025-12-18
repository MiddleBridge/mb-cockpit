@echo off
git add migration-documents-finance-links.sql
git add src/app/api/documents/upload/route.ts
git add src/app/api/documents/link/route.ts
git add src/app/actions/documents.ts
git add src/app/actions/financeDocuments.ts
git add src/server/finance/documents/transactionDocuments.ts
git add src/server/finance/documents/suggest.ts
git add src/components/finance/TransactionDrawerDocuments.tsx
git add src/components/documents/DocumentLinksPanel.tsx
git add DOCUMENTS_FINANCE_LINKS_IMPLEMENTATION.md
git commit -m "Add Documents ↔ Finance Transactions linking feature

- Migration for documents and document_links tables with RLS
- API routes for idempotent upload and link management
- Server actions for documents and finance transactions
- Suggestion engine with heuristic matching
- UI components for transaction drawer and document detail
- Support for both file_size and file_size_bytes columns"
git push
pause

