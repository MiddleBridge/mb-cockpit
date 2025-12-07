import { supabase } from '../supabase'

export interface Location {
  id: string
  name: string
  created_at?: string
}

export async function getLocations(): Promise<Location[]> {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    // If table doesn't exist, return empty array (will use fallback in component)
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      console.warn('Locations table does not exist. Run migration-add-reference-lists.sql')
      return []
    }
    console.error('Error fetching locations:', error)
    return []
  }

  return data || []
}

export async function addLocation(name: string): Promise<Location | null> {
  const { data, error } = await supabase
    .from('locations')
    .insert([{ name: name.trim() }])
    .select()
    .single()

  if (error) {
    console.error('Error adding location:', error)
    return null
  }

  return data
}

export async function deleteLocation(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('locations')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting location:', error)
    return false
  }

  return true
}

