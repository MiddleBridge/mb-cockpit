@echo off
git add src/server/documents/upload.ts src/components/finance/TransactionDrawerDocuments.tsx STORAGE_BUCKET_SETUP.md DIAGNOSTIC_STORAGE_BUCKET.md
git commit -m "Add diagnostic logging for Storage bucket errors - log Supabase URL, bucket names, and available buckets"
git push
