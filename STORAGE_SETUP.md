# Storage Setup Instructions

## Supabase Storage Setup

1. **Create Storage Bucket**:
   - Go to your Supabase project dashboard
   - Navigate to Storage
   - Click "New bucket"
   - Name: `mb-cockpit`
   - Make it **Public** (toggle "Public bucket" to ON)
   - Click "Create bucket"

2. **Configure RLS Policies** (REQUIRED):
   
   If you get "Permission denied" error, you need to create RLS policies.
   
   **Option A: Run SQL script** (Recommended):
   - Go to Supabase Dashboard → SQL Editor
   - Copy and paste the contents of `migration-storage-policies.sql`
   - Click "Run"
   
   **Option B: Manual setup**:
   - Go to Supabase Dashboard → Storage → Policies
   - Click "New Policy" for each operation:
   
   ```sql
   -- Allow public read access
   CREATE POLICY "Allow public read access"
   ON storage.objects FOR SELECT
   USING (bucket_id = 'mb-cockpit');

   -- Allow public upload
   CREATE POLICY "Allow public upload"
   ON storage.objects FOR INSERT
   WITH CHECK (bucket_id = 'mb-cockpit');

   -- Allow public update
   CREATE POLICY "Allow public update"
   ON storage.objects FOR UPDATE
   USING (bucket_id = 'mb-cockpit')
   WITH CHECK (bucket_id = 'mb-cockpit');

   -- Allow public delete
   CREATE POLICY "Allow public delete"
   ON storage.objects FOR DELETE
   USING (bucket_id = 'mb-cockpit');
   ```

## Google Drive Integration Setup

1. **Get Google API Key**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing
   - Enable "Google Picker API"
   - Go to "Credentials" → "Create Credentials" → "API Key"
   - Copy the API key

2. **Configure Environment Variable**:
   Add to your `.env`:
   ```env
   NEXT_PUBLIC_GOOGLE_API_KEY=your_google_api_key_here
   ```

3. **Restrict API Key** (Recommended):
   - In Google Cloud Console, edit your API key
   - Under "API restrictions", select "Restrict key"
   - Choose "Google Picker API"
   - Under "Application restrictions", you can restrict by HTTP referrer (your domain)

## Features

### Drag and Drop
- Drag files directly onto the upload area
- Files are automatically uploaded to Supabase Storage
- Form is auto-filled with file information

### Google Drive Integration
- Click "📁 Google Drive" button to open Google Picker
- Select files from your Google Drive
- Google Docs/Sheets are automatically converted to PDF/XLSX format
- File URL is automatically filled in the form

### Manual URL Entry
- You can still manually enter file URLs if needed
- Works with any publicly accessible file URL

## Usage

1. **Upload Local File**:
   - Drag and drop file onto the upload area, OR
   - Click "Choose File" button and select file
   - File is uploaded to Supabase Storage
   - URL is automatically filled

2. **Select from Google Drive**:
   - Click "📁 Google Drive" button
   - Select file from Google Picker
   - File URL is automatically filled

3. **Complete Form**:
   - Fill in document name (auto-filled from file name)
   - Optionally select contact/organisation
   - Add notes if needed
   - Click "Add Document"

## File Storage

Files uploaded via drag & drop are stored in Supabase Storage bucket `mb-cockpit`.
The public URL is stored in the database and can be accessed directly.

## Troubleshooting

### "Permission denied" error
- Make sure bucket `mb-cockpit` is set to **Public** in bucket settings
- Run the SQL script from `migration-storage-policies.sql` to create RLS policies
- Check that policies are created in Storage → Policies tab

### "Bucket not found" error
- Verify bucket name is exactly `mb-cockpit` (case-sensitive)
- Check that bucket exists in Supabase Dashboard → Storage
- Make sure bucket is public

