import { supabase } from '../supabase'

export interface Organisation {
  id: string
  name: string
  categories: string[]
  status?: 'ongoing' | 'freezed' | 'lost' | 'active_but_ceased' | null
  priority: 'low' | 'mid' | 'prio' | 'high prio'
  website?: string
  location?: string
  sector?: string
  notes?: string
  notes_updated_at?: string
  avatar?: string
  created_at?: string
  updated_at?: string
}

export async function getOrganisations(): Promise<Organisation[]> {
  const { data, error } = await supabase
    .from('organisations')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    // Don't log configuration errors or empty error objects
    const isEmptyError = typeof error === 'object' && error !== null && Object.keys(error).length === 0;
    const isConfigError = error.code === 'PGRST_CONFIG_ERROR' || 
                         error.message === 'Supabase is not configured' ||
                         isEmptyError;
    if (!isConfigError) {
      console.error('Error fetching organisations:', error)
    }
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
    // Don't log configuration errors (expected when Supabase is not configured)
    if (error.code !== 'PGRST_CONFIG_ERROR' && error.message !== 'Supabase is not configured') {
      console.error('Error creating organisation:', error)
    }
    return null
  }

  return data
}

export async function updateOrganisation(id: string, updates: Partial<Organisation>): Promise<Organisation | null> {
  // If notes is being updated, also update notes_updated_at
  const updateData: any = { ...updates, updated_at: new Date().toISOString() };
  if ('notes' in updates) {
    updateData.notes_updated_at = new Date().toISOString();
  }
  
  const { data, error } = await supabase
    .from('organisations')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    // Don't log configuration errors (expected when Supabase is not configured)
    if (error.code !== 'PGRST_CONFIG_ERROR' && error.message !== 'Supabase is not configured') {
      console.error('Error updating organisation:', error)
    }
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
    // Don't log configuration errors (expected when Supabase is not configured)
    if (error.code !== 'PGRST_CONFIG_ERROR' && error.message !== 'Supabase is not configured') {
      console.error('Error deleting organisation:', error)
    }
    return false
  }

  return true
}

// Helper function to get contacts for an organisation
export async function getContactsForOrganisation(orgName: string): Promise<any[]> {
  // Get contacts by organization (legacy field)
  const { data: byOrg, error: error1 } = await supabase
    .from('contacts')
    .select('*')
    .eq('organization', orgName);

  // Get all contacts and filter by organizations array in memory
  // (Supabase doesn't have great support for array contains with text arrays)
  const { data: allContacts, error: error2 } = await supabase
    .from('contacts')
    .select('*');

  if (error1 || error2) {
    const error = error1 || error2;
    // Don't log configuration errors (expected when Supabase is not configured)
    if (error?.code !== 'PGRST_CONFIG_ERROR' && error?.message !== 'Supabase is not configured') {
      console.error('Error fetching contacts for organisation:', error);
    }
    return [];
  }

  // Filter contacts that have this org in their organizations array
  const byOrgs = (allContacts || []).filter(contact => {
    const orgs = contact.organizations || [];
    return Array.isArray(orgs) && orgs.includes(orgName);
  });

  // Combine and deduplicate
  const all = [...(byOrg || []), ...byOrgs];
  const uniqueContacts = all.filter((contact, index, self) =>
    index === self.findIndex(c => c.id === contact.id)
  );

  return uniqueContacts;
}

// Function to inherit properties from contacts to organisation
export async function inheritPropertiesFromContacts(
  orgId: string,
  orgName: string,
  fieldsToInherit: ('website' | 'location' | 'sector' | 'categories')[]
): Promise<Organisation | null> {
  const contacts = await getContactsForOrganisation(orgName);
  
  if (contacts.length === 0) {
    console.log('No contacts found for organisation:', orgName);
    return null;
  }

  const updates: Partial<Organisation> = {};
  
  // Collect values from contacts
  const websites = new Set<string>();
  const locations = new Set<string>();
  const sectors = new Set<string>();
  const categories = new Set<string>();
  
  contacts.forEach(contact => {
    if (fieldsToInherit.includes('website') && contact.website) {
      websites.add(contact.website);
    }
    if (fieldsToInherit.includes('location') && contact.location) {
      locations.add(contact.location);
    }
    if (fieldsToInherit.includes('sector') && contact.sector) {
      sectors.add(contact.sector);
    }
    if (fieldsToInherit.includes('categories') && contact.categories) {
      contact.categories.forEach((cat: string) => categories.add(cat));
    }
  });
  
  // Apply most common or first value
  if (fieldsToInherit.includes('website') && websites.size > 0) {
    updates.website = Array.from(websites)[0]; // Take first website
  }
  if (fieldsToInherit.includes('location') && locations.size > 0) {
    // Count occurrences and take most common
    const locationCounts: Record<string, number> = {};
    contacts.forEach(c => {
      if (c.location) {
        locationCounts[c.location] = (locationCounts[c.location] || 0) + 1;
      }
    });
    const mostCommonLocation = Object.entries(locationCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (mostCommonLocation) {
      updates.location = mostCommonLocation;
    }
  }
  if (fieldsToInherit.includes('sector') && sectors.size > 0) {
    // Count occurrences and take most common
    const sectorCounts: Record<string, number> = {};
    contacts.forEach(c => {
      if (c.sector) {
        sectorCounts[c.sector] = (sectorCounts[c.sector] || 0) + 1;
      }
    });
    const mostCommonSector = Object.entries(sectorCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (mostCommonSector) {
      updates.sector = mostCommonSector;
    }
  }
  if (fieldsToInherit.includes('categories') && categories.size > 0) {
    // Get current categories and merge with inherited ones
    const org = await getOrganisations();
    const currentOrg = org.find(o => o.id === orgId);
    const currentCategories = new Set(currentOrg?.categories || []);
    categories.forEach(cat => currentCategories.add(cat));
    updates.categories = Array.from(currentCategories);
  }
  
  if (Object.keys(updates).length > 0) {
    return await updateOrganisation(orgId, updates);
  }
  
  return null;
}





