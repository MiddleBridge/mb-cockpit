import { supabase } from '../supabase'

export interface Organisation {
  id: string
  name: string
  categories: string[]
  created_at?: string
  updated_at?: string
}

export async function getOrganisations(): Promise<Organisation[]> {
  const { data, error } = await supabase
    .from('organisations')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching organisations:', error)
    return []
  }

  return data || []
}

export async function createOrganisation(organisation: Omit<Organisation, 'id' | 'created_at' | 'updated_at'>): Promise<Organisation | null> {
  const { data, error } = await supabase
    .from('organisations')
    .insert([organisation])
    .select()
    .single()

  if (error) {
    console.error('Error creating organisation:', error)
    return null
  }

  return data
}

export async function updateOrganisation(id: string, updates: Partial<Organisation>): Promise<Organisation | null> {
  const { data, error } = await supabase
    .from('organisations')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating organisation:', error)
    return null
  }

  return data
}

export async function deleteOrganisation(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('organisations')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting organisation:', error)
    return false
  }

  return true
}


