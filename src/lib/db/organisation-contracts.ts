import { supabase } from '../supabase'

export interface OrganisationDocument {
  id: string
  organisation_id: string
  name: string
  type: string
  storage_path: string
  uploaded_at: string
  parsed_text?: string
  analysis_guide?: string
  ai_analysis_result?: any // JSONB field for storing AI analysis results
}

export interface OrganisationContractComment {
  id: string
  organisation_id: string
  document_id?: string
  created_at: string
  author?: string
  comment_text: string
  severity: 'low' | 'medium' | 'high'
}

export interface OrganisationContractTerm {
  id: string
  organisation_id: string
  document_id?: string
  term_key: string
  term_label: string
  term_value: string
  start_date?: string
  end_date?: string
  renewal_type?: 'none' | 'fixed' | 'auto'
  renewal_date?: string
  billing_cycle?: 'monthly' | 'quarterly' | 'yearly'
  importance: 'low' | 'medium' | 'high'
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface OrganisationContractsPayload {
  documents: OrganisationDocument[]
  comments: OrganisationContractComment[]
  terms: OrganisationContractTerm[]
}

// Documents
export async function getOrganisationDocuments(organisationId: string): Promise<OrganisationDocument[]> {
  const { data, error } = await supabase
    .from('organisation_documents')
    .select('*')
    .eq('organisation_id', organisationId)
    .order('uploaded_at', { ascending: false })

  if (error) {
    // Don't log configuration errors or empty error objects
    const isEmptyError = typeof error === 'object' && error !== null && Object.keys(error).length === 0;
    const isConfigError = error.code === 'PGRST_CONFIG_ERROR' || 
                         error.message === 'Supabase is not configured' ||
                         isEmptyError;
    if (!isConfigError) {
      console.error('Error fetching organisation documents:', error)
    }
    return []
  }

  return data || []
}

export async function createOrganisationDocument(
  document: Omit<OrganisationDocument, 'id' | 'uploaded_at'>
): Promise<OrganisationDocument | null> {
  const { data, error } = await supabase
    .from('organisation_documents')
    .insert([document])
    .select()
    .single()

  if (error) {
    console.error('Error creating organisation document:', error)
    return null
  }

  return data
}

export async function updateOrganisationDocument(
  id: string,
  updates: Partial<OrganisationDocument>
): Promise<OrganisationDocument | null> {
  const { data, error } = await supabase
    .from('organisation_documents')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating organisation document:', error)
    return null
  }

  return data
}

export async function deleteOrganisationDocument(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('organisation_documents')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting organisation document:', error)
    return false
  }

  return true
}

// Comments
export async function getOrganisationContractComments(organisationId: string): Promise<OrganisationContractComment[]> {
  const { data, error } = await supabase
    .from('organisation_contract_comments')
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
      console.error('Error fetching organisation contract comments:', error)
    }
    return []
  }

  return data || []
}

export async function createOrganisationContractComment(
  comment: Omit<OrganisationContractComment, 'id' | 'created_at'>
): Promise<OrganisationContractComment | null> {
  const { data, error } = await supabase
    .from('organisation_contract_comments')
    .insert([comment])
    .select()
    .single()

  if (error) {
    console.error('Error creating organisation contract comment:', error)
    return null
  }

  return data
}

export async function updateOrganisationContractComment(
  id: string,
  updates: Partial<OrganisationContractComment>
): Promise<OrganisationContractComment | null> {
  const { data, error } = await supabase
    .from('organisation_contract_comments')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating organisation contract comment:', error)
    return null
  }

  return data
}

export async function deleteOrganisationContractComment(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('organisation_contract_comments')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting organisation contract comment:', error)
    return false
  }

  return true
}

// Terms
export async function getOrganisationContractTerms(organisationId: string, activeOnly: boolean = true): Promise<OrganisationContractTerm[]> {
  let query = supabase
    .from('organisation_contract_terms')
    .select('*')
    .eq('organisation_id', organisationId)

  if (activeOnly) {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) {
    // Don't log configuration errors or empty error objects
    const isEmptyError = typeof error === 'object' && error !== null && Object.keys(error).length === 0;
    const isConfigError = error.code === 'PGRST_CONFIG_ERROR' || 
                         error.message === 'Supabase is not configured' ||
                         isEmptyError;
    if (!isConfigError) {
      console.error('Error fetching organisation contract terms:', error)
    }
    return []
  }

  return data || []
}

export async function createOrganisationContractTerm(
  term: Omit<OrganisationContractTerm, 'id' | 'created_at' | 'updated_at'>
): Promise<OrganisationContractTerm | null> {
  const { data, error } = await supabase
    .from('organisation_contract_terms')
    .insert([term])
    .select()
    .single()

  if (error) {
    console.error('Error creating organisation contract term:', error)
    return null
  }

  return data
}

export async function updateOrganisationContractTerm(
  id: string,
  updates: Partial<OrganisationContractTerm>
): Promise<OrganisationContractTerm | null> {
  const { data, error } = await supabase
    .from('organisation_contract_terms')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating organisation contract term:', error)
    return null
  }

  return data
}

export async function deleteOrganisationContractTerm(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('organisation_contract_terms')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting organisation contract term:', error)
    return false
  }

  return true
}

// Combined fetch
export async function getOrganisationContracts(organisationId: string): Promise<OrganisationContractsPayload> {
  const [documents, comments, terms] = await Promise.all([
    getOrganisationDocuments(organisationId),
    getOrganisationContractComments(organisationId),
    getOrganisationContractTerms(organisationId, true)
  ])

  return {
    documents,
    comments,
    terms
  }
}

