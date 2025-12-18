import { supabase } from '../supabase'

export type InvoiceType = 'cost' | 'revenue';
export type TaxType = 'CIT' | 'VAT';

export interface Document {
  id: string
  name: string
  file_url: string
  file_type?: string
  file_size?: number
  document_type?: string // Rodzaj dokumentu (umowa, faktura, etc.)
  contact_id?: string
  organisation_id?: string
  notes?: string
  edit_url?: string
  google_docs_url?: string // Link to Google Docs where work is being done (for PDF files)
  project_id?: string // Link to project
  task_id?: string // Link to task (format: "contactId-taskId")
  full_text?: string // Pełna treść dokumentu "słowo w słowo"
  summary?: string // Podsumowanie i najważniejsze informacje
  invoice_type?: InvoiceType | null
  tax_type?: TaxType | null
  amount_original?: number | null
  currency?: string | null
  amount_base?: number | null
  base_currency?: string | null
  invoice_date?: string | null // ISO date
  invoice_year?: number | null
  invoice_month?: number | null
  source_gmail_message_id?: string | null
  source_gmail_attachment_id?: string | null
  contact_email?: string | null
  contact_name?: string | null
  organisation_name_guess?: string | null
  created_at?: string
  updated_at?: string
}

export async function getDocuments(): Promise<Document[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    // Don't log configuration errors or empty error objects
    const isEmptyError = typeof error === 'object' && error !== null && Object.keys(error).length === 0;
    const isConfigError = error.code === 'PGRST_CONFIG_ERROR' || 
                         error.message === 'Supabase is not configured' ||
                         isEmptyError;
    if (!isConfigError) {
      console.error('Error fetching documents:', error)
    }
    return []
  }

  return data || []
}

export async function getDocumentsByContact(contactId: string): Promise<Document[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })

  if (error) {
    // Don't log configuration errors or empty error objects
    const isEmptyError = typeof error === 'object' && error !== null && Object.keys(error).length === 0;
    const isConfigError = error.code === 'PGRST_CONFIG_ERROR' || 
                         error.message === 'Supabase is not configured' ||
                         isEmptyError;
    if (!isConfigError) {
      console.error('Error fetching documents by contact:', error)
    }
    return []
  }

  return data || []
}

export async function getDocumentsByOrganisation(organisationId: string): Promise<Document[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('organisation_id', organisationId)
    .order('created_at', { ascending: false })

  if (error) {
    // Don't log configuration errors or empty error objects
    const isEmptyError = typeof error === 'object' && error !== null && Object.keys(error).length === 0;
    const isConfigError = error.code === 'PGRST_CONFIG_ERROR' || 
                         error.message === 'Supabase is not configured' ||
                         isEmptyError;
    if (!isConfigError) {
      console.error('Error fetching documents by organisation:', error)
    }
    return []
  }

  return data || []
}

export async function createDocument(document: Omit<Document, 'id' | 'created_at' | 'updated_at'>): Promise<Document | null> {
  const { data, error } = await supabase
    .from('documents')
    .insert([document])
    .select()
    .single()

  if (error) {
    // Don't log configuration errors (expected when Supabase is not configured)
    if (error.code !== 'PGRST_CONFIG_ERROR' && error.message !== 'Supabase is not configured') {
      console.error('Error creating document:', error)
    }
    return null
  }

  return data
}

export async function updateDocument(id: string, updates: Partial<Document>): Promise<Document | null> {
  const { data, error } = await supabase
    .from('documents')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    // Don't log configuration errors (expected when Supabase is not configured)
    if (error.code !== 'PGRST_CONFIG_ERROR' && error.message !== 'Supabase is not configured') {
      console.error('Error updating document:', error)
    }
    return null
  }

  return data
}

export async function getDocumentsByProject(projectId: string): Promise<Document[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) {
    // Don't log configuration errors or empty error objects
    const isEmptyError = typeof error === 'object' && error !== null && Object.keys(error).length === 0;
    const isConfigError = error.code === 'PGRST_CONFIG_ERROR' || 
                         error.message === 'Supabase is not configured' ||
                         isEmptyError;
    if (!isConfigError) {
      console.error('Error fetching documents by project:', error)
    }
    return []
  }

  return data || []
}

export async function getDocumentsByTask(taskId: string): Promise<Document[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false })

  if (error) {
    // Don't log configuration errors or empty error objects
    const isEmptyError = typeof error === 'object' && error !== null && Object.keys(error).length === 0;
    const isConfigError = error.code === 'PGRST_CONFIG_ERROR' || 
                         error.message === 'Supabase is not configured' ||
                         isEmptyError;
    if (!isConfigError) {
      console.error('Error fetching documents by task:', error)
    }
    return []
  }

  return data || []
}

export async function getDocumentsByGmailMessage(messageId: string): Promise<Document[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('source_gmail_message_id', messageId)
    .order('created_at', { ascending: false })

  if (error) {
    // Don't log configuration errors or empty error objects
    const isEmptyError = typeof error === 'object' && error !== null && Object.keys(error).length === 0;
    const isConfigError = error.code === 'PGRST_CONFIG_ERROR' || 
                         error.message === 'Supabase is not configured' ||
                         isEmptyError;
    if (!isConfigError) {
      console.error('Error fetching documents by Gmail message:', error)
    }
    return []
  }

  return data || []
}

export async function deleteDocument(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', id)

  if (error) {
    // Don't log configuration errors (expected when Supabase is not configured)
    if (error.code !== 'PGRST_CONFIG_ERROR' && error.message !== 'Supabase is not configured') {
      console.error('Error deleting document:', error)
    }
    return false
  }

  return true
}
