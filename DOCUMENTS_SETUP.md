# Documents Setup

## Database Migration

To enable the documents feature, you need to run the migration script in Supabase:

1. Open your Supabase project dashboard
2. Go to SQL Editor
3. Copy and paste the contents of `migration-add-documents.sql`
4. Run the query

This will create:
- `documents` table with fields for name, file_url, file_type, contact_id, organisation_id, notes
- Indexes for faster queries
- RLS policies (currently allowing all operations)

## Features

### Documents View
- View all documents in one place
- Search documents by name
- Filter by contact or organisation
- Add new documents with file URL
- Delete documents

### Documents in Contacts
- Each contact can have multiple documents
- Add documents directly from the contact view
- Documents are also visible in the main Documents tab
- Same document can be linked to both contact and organisation

## Usage

1. **Add document to contact**: 
   - Open a contact
   - Click "+ Add Document"
   - Enter document name, file URL, file type (optional), and notes (optional)

2. **View all documents**:
   - Click "Documents" in the navigation
   - Use search and filters to find specific documents

3. **Link document to organisation**:
   - When adding a document, you can optionally link it to an organisation
   - Documents can be linked to both contact and organisation simultaneously




