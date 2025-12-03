-- Add new columns to documents table for linking to projects, tasks, and Google Docs
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS google_docs_url TEXT,
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS task_id TEXT; -- Format: "contactId-taskId" since tasks are stored in contacts.tasks JSON

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_task_id ON documents(task_id);

-- Add comment
COMMENT ON COLUMN documents.google_docs_url IS 'Link to Google Docs where work is being done (for PDF files)';
COMMENT ON COLUMN documents.project_id IS 'Link to project if document is associated with a project';
COMMENT ON COLUMN documents.task_id IS 'Link to task if document is associated with a task (format: contactId-taskId)';


