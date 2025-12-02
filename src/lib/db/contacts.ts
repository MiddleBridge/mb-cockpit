import { supabase } from '../supabase'

export interface Contact {
  id: string
  name: string
  email?: string
  avatar?: string
  organization?: string
  notes?: string
  categories: string[]
  status: 'low' | 'mid' | 'prio' | 'high prio'
  tasks: Array<{
    id: string
    text: string
    completed: boolean
    status?: 'ongoing' | 'done' | 'failed'
    priority?: 'low' | 'mid' | 'prio' | 'high prio'
    dueDate?: string
    notes?: string
    assignees?: string[] // Array of contact IDs
    created_at?: string
  }>
  created_at?: string
  updated_at?: string
}

export async function getContacts(): Promise<Contact[]> {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching contacts:', error)
    return []
  }

  return data || []
}

export async function createContact(contact: Omit<Contact, 'id' | 'created_at' | 'updated_at'>): Promise<Contact | null> {
  // Check if contact with same name and organization already exists
  if (contact.organization) {
    const { data: existing } = await supabase
      .from('contacts')
      .select('id, name, organization')
      .eq('name', contact.name)
      .eq('organization', contact.organization)
      .maybeSingle()

    if (existing) {
      console.error('Contact already exists in this organization:', contact.name, contact.organization)
      return null
    }
  } else {
    // Check if contact with same name exists without organization
    const { data: existing } = await supabase
      .from('contacts')
      .select('id, name, organization')
      .eq('name', contact.name)
      .is('organization', null)
      .maybeSingle()

    if (existing) {
      console.error('Contact already exists without organization:', contact.name)
      return null
    }
  }

  console.log('Creating contact with avatar:', contact.avatar);
  const { data, error } = await supabase
    .from('contacts')
    .insert([contact])
    .select()
    .single()

  if (error) {
    console.error('Error creating contact:', error)
    // Check if it's a unique constraint violation
    if (error.code === '23505') {
      console.error('Contact already exists in this organization')
    }
    // Check if it's a column doesn't exist error
    if (error.message?.includes('avatar') || error.message?.includes('column')) {
      console.error('Avatar column might not exist in database. Run migration-add-avatar.sql in Supabase SQL Editor.')
    }
    return null
  }

  console.log('Contact created successfully with avatar:', data?.avatar);
  return data
}

export async function updateContact(id: string, updates: Partial<Contact>): Promise<Contact | null> {
  const { data, error } = await supabase
    .from('contacts')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating contact:', error)
    return null
  }

  return data
}

export async function deleteContact(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting contact:', error)
    return false
  }

  return true
}


