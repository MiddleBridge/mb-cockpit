import { supabase } from '../supabase'

export interface Role {
  id: string
  name: string
  created_at?: string
}

export async function getRoles(): Promise<string[]> {
  const { data, error } = await supabase
    .from('roles')
    .select('name')
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching roles:', error)
    return []
  }

  return data?.map(r => r.name) || []
}

export async function createRole(name: string): Promise<Role | null> {
  const { data, error } = await supabase
    .from('roles')
    .insert([{ name: name.trim() }])
    .select()
    .single()

  if (error) {
    console.error('Error creating role:', error)
    return null
  }

  return data
}

export async function deleteRoleById(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('roles')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting role:', error)
    return false
  }

  return true
}

export async function deleteRoleByName(name: string): Promise<boolean> {
  // First get the role by name to find its ID
  const { data, error: fetchError } = await supabase
    .from('roles')
    .select('id')
    .eq('name', name)
    .single()

  if (fetchError || !data) {
    console.error('Error finding role:', fetchError)
    return false
  }

  return deleteRoleById(data.id)
}




