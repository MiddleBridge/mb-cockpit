import { supabase } from '../supabase'

export interface Document {
  id: string
  name: string
  file_url: string
  file_type?: string
  file_size?: number
  contact_id?: string
  organisation_id?: string
  notes?: string
  edit_url?: string
  created_at?: string
  updated_at?: string
}

export async function getDocuments(): Promise<Document[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching documents:', error)
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
    console.error('Error fetching documents by contact:', error)
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
    console.error('Error fetching documents by organisation:', error)
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
    console.error('Error creating document:', error)
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
    console.error('Error updating document:', error)
    return null
  }

  return data
}

export async function deleteDocument(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting document:', error)
    return false
  }

  return true
}
