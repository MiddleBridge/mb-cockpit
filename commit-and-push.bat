@echo off
git add -A
git commit -m "Add trip expenses, evidence, and reimbursement features

- Add database migration for trip expenses and evidence tracking
- Add project_id, paid_by_company_card, exclude_from_reimbursement to transactions
- Create evidence and evidence_links tables
- Add EvidenceUploader component with drag&drop, paste, file upload
- Add EvidenceGallery component with thumbnails
- Add ReimbursementSummary component with currency grouping
- Add TripProjectView with tabs (Overview, Expenses, Evidence, Reimbursement)
- Update TransactionDrawer with reimbursement toggles and evidence section
- Update TransactionsWorkbench with reimbursement column and toggle
- Add server actions for updating transaction reimbursement flags
- Add API endpoints for evidence upload and signed URLs
- Update transaction queries to support project filtering"
git push
