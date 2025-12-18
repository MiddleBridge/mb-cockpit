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
    status?: 'ongoing' | 'done' | 'failed'
    priority?: 'low' | 'mid' | 'prio' | 'high prio'
    dueDate?: string
    notes?: string
    assignees?: string[] // Array of contact IDs
    created_at?: string
    completed_at?: string // Date when task was completed
    subtasks?: Array<{
      id: string
      text: string
      completed: boolean
      dueDate?: string
      created_at?: string
      completed_at?: string
    }>
  }>
  created_at?: string
  updated_at?: string
}

export async function getContacts(): Promise<Contact[]> {
  console.log('📥 Fetching contacts from database...');
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    // Don't log configuration errors or empty error objects
    const isEmptyError = typeof error === 'object' && error !== null && Object.keys(error).length === 0;
    const isConfigError = error.code === 'PGRST_CONFIG_ERROR' || 
                         error.message === 'Supabase is not configured' ||
                         isEmptyError;
    if (!isConfigError) {
      console.error('❌ Error fetching contacts:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      })
    } else {
      console.warn('⚠️ Supabase not configured - returning empty array');
    }
    return []
  }

  console.log(`✅ Fetched ${data?.length || 0} contacts from database`);

  // Normalize data: ensure organizations and projects are arrays
  return (data || []).map((contact: any) => ({
    ...contact,
    organizations: contact.organizations || (contact.organization ? [contact.organization] : []),
    projects: contact.projects || [],
    categories: Array.isArray(contact.categories) ? contact.categories : [],
    tasks: Array.isArray(contact.tasks) ? contact.tasks : [],
  }))
}

export async function createContact(contact: Omit<Contact, 'id' | 'created_at' | 'updated_at'>): Promise<Contact | null> {
  // Ensure categories is always an array
  const contactData = {
    ...contact,
    categories: Array.isArray(contact.categories) ? contact.categories : [],
    tasks: Array.isArray(contact.tasks) ? contact.tasks : [],
  };

  console.log('📝 Creating contact:', {
    name: contactData.name,
    organization: contactData.organization,
    categories: contactData.categories,
    status: contactData.status,
    hasEmail: !!contactData.email,
    hasAvatar: !!contactData.avatar,
  });

  // Check if contact with same name and organization already exists
  if (contactData.organization) {
    const { data: existing, error: checkError } = await supabase
      .from('contacts')
      .select('id, name, organization')
      .eq('name', contactData.name)
      .eq('organization', contactData.organization)
      .maybeSingle()

    if (checkError && checkError.code !== 'PGRST_CONFIG_ERROR') {
      console.error('❌ Error checking for existing contact:', checkError)
    }

    if (existing) {
      console.error('❌ Contact already exists in this organization:', contactData.name, contactData.organization)
      return null
    }
  } else {
    // Check if contact with same name exists without organization
    const { data: existing, error: checkError } = await supabase
      .from('contacts')
      .select('id, name, organization')
      .eq('name', contactData.name)
      .is('organization', null)
      .maybeSingle()

    if (checkError && checkError.code !== 'PGRST_CONFIG_ERROR') {
      console.error('❌ Error checking for existing contact:', checkError)
    }

    if (existing) {
      console.error('❌ Contact already exists without organization:', contactData.name)
      return null
    }
  }

  console.log('✅ No duplicate found, inserting contact...');
  console.log('📤 Inserting contact data:', JSON.stringify(contactData, null, 2));
  
  // Check if Supabase client is available
  if (!supabase) {
    console.error('❌ Supabase client is null! Check your .env file.');
    return null;
  }
  
  const { data, error } = await supabase
    .from('contacts')
    .insert([contactData])
    .select()
    .single()

  if (error) {
    console.error('❌ Error creating contact:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      fullError: error,
    })
    // Check if it's a unique constraint violation
    if (error.code === '23505') {
      console.error('❌ Contact already exists in this organization (unique constraint violation)')
      alert(`Contact "${contactData.name}" already exists in this organization.`);
    }
    // Check if it's a column doesn't exist error
    if (error.message?.includes('avatar') || error.message?.includes('column') || error.message?.includes('does not exist')) {
      console.error('❌ Column might not exist in database. Check migrations.')
      alert(`Database error: A column might be missing. Check console for details.`);
    }
    // Check if Supabase is not configured
    if (error.code === 'PGRST_CONFIG_ERROR' || error.message === 'Supabase is not configured') {
      console.error('❌ Supabase is not configured! Check your .env file.')
      alert(`Supabase is not configured! Check your .env file for NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY`);
    }
    return null
  }

  if (!data) {
    console.error('❌ Contact creation returned no data (but no error)')
    console.error('❌ This might mean Supabase is using a mock client. Check your .env file.');
    alert(`Contact was not saved. Check console for details.`);
    return null
  }

  console.log('✅ Contact created successfully:', {
    id: data.id,
    name: data.name,
    organization: data.organization,
    created_at: data.created_at,
  });
  return data
}

export async function updateContact(id: string, updates: Partial<Contact>): Promise<Contact | null> {
  // If notes is being updated, also update notes_updated_at
  const updateData: any = { ...updates, updated_at: new Date().toISOString() };
  if ('notes' in updates) {
    updateData.notes_updated_at = new Date().toISOString();
  }
  
  // Sync organizations array with legacy organization field
  if ('organizations' in updates && Array.isArray(updates.organizations)) {
    // If organizations array is provided, also update legacy organization field with first item
    if (updates.organizations.length > 0) {
      updateData.organization = updates.organizations[0];
    } else {
      updateData.organization = null;
    }
  } else if ('organization' in updates && updates.organization) {
    // If legacy organization is updated, also update organizations array
    updateData.organizations = [updates.organization];
  }
  
  // Ensure arrays are properly formatted
  if ('organizations' in updateData && !Array.isArray(updateData.organizations)) {
    updateData.organizations = [];
  }
  if ('categories' in updateData && !Array.isArray(updateData.categories)) {
    updateData.categories = [];
  }
  if ('projects' in updateData && !Array.isArray(updateData.projects)) {
    updateData.projects = [];
  }
  
  console.log('📝 Updating contact:', { id, updates: updateData });
  
  const { data, error } = await supabase
    .from('contacts')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('❌ Error updating contact:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      fullError: error,
    })
    return null
  }

  if (!data) {
    console.error('❌ Contact update returned no data (but no error)')
    return null
  }

  console.log('✅ Contact updated successfully:', { id: data.id, name: data.name });
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


