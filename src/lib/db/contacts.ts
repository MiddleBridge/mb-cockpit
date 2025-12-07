import { supabase } from '../supabase'

export interface Contact {
  id: string
  name: string
  email?: string
  avatar?: string
  organization?: string // Legacy field, kept for backward compatibility
  organizations?: string[] // New field for multiple organizations
  notes?: string
  notes_updated_at?: string
  website?: string
  location?: string
  nationality?: string
  categories: string[]
  status: 'low' | 'mid' | 'prio' | 'high prio'
  contact_status?: 'ongoing' | 'freezed'
  role?: string
  sector?: string
  projects?: string[] // Array of project IDs
  tasks: Array<{
    id: string
    text: string
    completed: boolean
    status?: 'open' | 'done' | 'failed'
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

  // Normalize data: ensure organizations and projects are arrays
  return (data || []).map((contact: any) => ({
    ...contact,
    organizations: contact.organizations || (contact.organization ? [contact.organization] : []),
    projects: contact.projects || [],
  }))
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
  // If notes is being updated, also update notes_updated_at
  const updateData: any = { ...updates, updated_at: new Date().toISOString() };
  if ('notes' in updates) {
    updateData.notes_updated_at = new Date().toISOString();
  }
  
  const { data, error } = await supabase
    .from('contacts')
    .update(updateData)
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


