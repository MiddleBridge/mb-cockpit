import { supabase } from '../supabase'

export interface Sector {
  id: number // int8 in Supabase
  name: string
  slug: string
  created_at?: string
}

export async function getSectors(): Promise<Sector[]> {
  const { data, error } = await supabase
    .from('sectors')
    .select('id, name, slug, created_at')
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching sectors:', error)
    return []
  }

  return data || []
}

export async function addSector(name: string): Promise<Sector | null> {
  // Generate slug from name
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  
  const { data, error } = await supabase
    .from('sectors')
    .insert([{ name: name.trim(), slug }])
    .select()
    .single()

  if (error) {
    console.error('Error adding sector:', error)
    return null
  }

  return data
}

export async function deleteSector(id: number): Promise<boolean> {
  const { error } = await supabase
    .from('sectors')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting sector:', error)
    return false
  }

  return true
}

