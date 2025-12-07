import { supabase } from '../supabase'

export interface Website {
  id: string
  url: string
  created_at?: string
}

export async function getWebsites(): Promise<Website[]> {
  const { data, error } = await supabase
    .from('websites')
    .select('*')
    .order('url', { ascending: true })

  if (error) {
    console.error('Error fetching websites:', error)
    return []
  }

  return data || []
}

export async function addWebsite(url: string): Promise<Website | null> {
  const { data, error } = await supabase
    .from('websites')
    .insert([{ url: url.trim() }])
    .select()
    .single()

  if (error) {
    console.error('Error adding website:', error)
    return null
  }

  return data
}

export async function deleteWebsite(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('websites')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting website:', error)
    return false
  }

  return true
}

