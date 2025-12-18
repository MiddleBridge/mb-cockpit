import { supabase } from '../supabase'

export interface LawNote {
  id: string
  title?: string
  content: string
  document_type?: string
  created_at?: string
  updated_at?: string
}

const LAW_NOTE_ID = 'law-main-note'

export async function getLawNote(): Promise<LawNote | null> {
  const { data, error } = await supabase
    .from('law_notes')
    .select('*')
    .eq('id', LAW_NOTE_ID)
    .maybeSingle()

  if (error) {
    // Don't log configuration errors or empty error objects
    const isEmptyError = typeof error === 'object' && error !== null && Object.keys(error).length === 0;
    const isConfigError = error.code === 'PGRST_CONFIG_ERROR' || 
                         error.message === 'Supabase is not configured' ||
                         isEmptyError;
    if (!isConfigError) {
      console.error('Error fetching law note:', error)
    }
    return null
  }

  if (!data) {
    return null
  }

  return {
    id: data.id,
    title: data.title || '',
    content: data.content || '',
    document_type: data.document_type || '',
    created_at: data.created_at,
    updated_at: data.updated_at
  }
}

export async function saveLawNote(note: { title?: string; content: string; document_type?: string }): Promise<boolean> {
  // Check if note exists
  const existingNote = await getLawNote()
  const now = new Date().toISOString()
  
  // Use upsert to handle both insert and update
  const { error } = await supabase
    .from('law_notes')
    .upsert({
      id: LAW_NOTE_ID,
      title: note.title || '',
      content: note.content,
      document_type: note.document_type || '',
      created_at: existingNote ? existingNote.created_at : now,
      updated_at: now
    }, {
      onConflict: 'id'
    })

  if (error) {
    console.error('Error saving law note:', error)
    return false
  }

  return true
}

/**
 * Get law note by document type
 * Maps contract document types to law note document types
 */
export async function getLawNoteByDocumentType(contractType: string): Promise<LawNote | null> {
  // Map contract types to law note document types
  const typeMapping: Record<string, string> = {
    'main_contract': 'Contract',
    'annex': 'Agreement',
    'nda': 'NDA',
    'sow': 'Contract'
  }
  
  const lawNoteType = typeMapping[contractType] || 'Contract'
  
  // Try to find note with matching document_type
  const { data, error } = await supabase
    .from('law_notes')
    .select('*')
    .eq('document_type', lawNoteType)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    // Don't log configuration errors or empty error objects
    const isEmptyError = typeof error === 'object' && error !== null && Object.keys(error).length === 0;
    const isConfigError = error.code === 'PGRST_CONFIG_ERROR' || 
                         error.message === 'Supabase is not configured' ||
                         isEmptyError;
    if (!isConfigError) {
      console.error('Error fetching law note by type:', error)
    }
    return null
  }

  if (!data) {
    // Fallback: try to get main note
    return await getLawNote()
  }

  return {
    id: data.id,
    title: data.title || '',
    content: data.content || '',
    document_type: data.document_type || '',
    created_at: data.created_at,
    updated_at: data.updated_at
  }
}

