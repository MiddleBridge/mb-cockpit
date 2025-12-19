import { supabase } from '../supabase'

export interface GeneralNote {
  id: string
  title?: string
  content: string
  source?: string
  created_at?: string
  updated_at?: string
}

const GENERAL_NOTE_ID = 'general-main-note'

export async function getGeneralNote(): Promise<GeneralNote | null> {
  const { data, error } = await supabase
    .from('general_notes')
    .select('*')
    .eq('id', GENERAL_NOTE_ID)
    .maybeSingle()

  if (error) {
    // Don't log configuration errors or empty error objects
    const isEmptyError = typeof error === 'object' && error !== null && Object.keys(error).length === 0;
    const isConfigError = error.code === 'PGRST_CONFIG_ERROR' || 
                         error.message === 'Supabase is not configured' ||
                         isEmptyError;
    if (!isConfigError) {
      console.error('Error fetching general note:', error)
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
    source: data.source || '',
    created_at: data.created_at,
    updated_at: data.updated_at
  }
}

export async function saveGeneralNote(note: { title?: string; content: string; source?: string }): Promise<boolean> {
  const existingNote = await getGeneralNote()
  const now = new Date().toISOString()
  
  // Use upsert to handle both insert and update
  const { error } = await supabase
    .from('general_notes')
    .upsert({
      id: GENERAL_NOTE_ID,
      title: note.title || '',
      content: note.content,
      source: note.source || '',
      created_at: existingNote ? existingNote.created_at : now,
      updated_at: now
    }, {
      onConflict: 'id'
    })

  if (error) {
    console.error('Error saving general note:', error)
    return false
  }

  return true
}
