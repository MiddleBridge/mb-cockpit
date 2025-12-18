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
    // If table doesn't exist (PGRST205 = table not found in schema cache)
    if (error.code === '42P01' || error.code === 'PGRST205' || error.message?.includes('does not exist') || error.message?.includes('Could not find the table')) {
      // Silent fail - table doesn't exist, return empty array (will use fallback in component)
      return []
    }
    
    // Don't log empty error objects or configuration errors
    const isEmptyError = typeof error === 'object' && error !== null && Object.keys(error).length === 0;
    const hasNoMeaningfulContent = !error.code && !error.message && !error.hint && !error.details;
    const serializesToEmpty = JSON.stringify(error) === '{}';
    const isConfigError = error.code === 'PGRST_CONFIG_ERROR' || 
                         error.message === 'Supabase is not configured' ||
                         isEmptyError ||
                         hasNoMeaningfulContent ||
                         serializesToEmpty;
    
    if (!isConfigError) {
      console.error('❌ Error fetching locations:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      })
    } else {
      // Silent fail for config/empty errors
      return []
    }
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
    // Don't log configuration errors (expected when Supabase is not configured)
    if (error.code !== 'PGRST_CONFIG_ERROR' && error.message !== 'Supabase is not configured') {
      console.error('Error adding location:', error)
    }
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
    // Don't log configuration errors (expected when Supabase is not configured)
    if (error.code !== 'PGRST_CONFIG_ERROR' && error.message !== 'Supabase is not configured') {
      console.error('Error deleting location:', error)
    }
    return false
  }

  return true
}

