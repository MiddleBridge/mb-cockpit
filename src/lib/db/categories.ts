import { supabase } from '../supabase'

export interface Category {
  id: string
  name: string
  created_at?: string
}

export async function getCategories(): Promise<string[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('name')
    .order('name', { ascending: true })

  if (error) {
    // Don't log configuration errors or empty error objects
    const isEmptyError = typeof error === 'object' && error !== null && Object.keys(error).length === 0;
    const isConfigError = error.code === 'PGRST_CONFIG_ERROR' || 
                         error.message === 'Supabase is not configured' ||
                         isEmptyError;
    if (!isConfigError) {
      console.error('Error fetching categories:', error)
    }
    return []
  }

  return data?.map(c => c.name) || []
}

export async function createCategory(name: string): Promise<Category | null> {
  const { data, error } = await supabase
    .from('categories')
    .insert([{ name: name.trim() }])
    .select()
    .single()

  if (error) {
    console.error('Error creating category:', error)
    return null
  }

  return data
}

export async function deleteCategoryById(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting category:', error)
    return false
  }

  return true
}

export async function deleteCategoryByName(name: string): Promise<boolean> {
  // First get the category by name to find its ID
  const { data, error: fetchError } = await supabase
    .from('categories')
    .select('id')
    .eq('name', name)
    .single()

  if (fetchError || !data) {
    console.error('Error finding category:', fetchError)
    return false
  }

  return deleteCategoryById(data.id)
}

