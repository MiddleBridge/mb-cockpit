import { supabase } from '../supabase'

export type ProjectType = 'mb-2.0' | 'internal'

// Input type for creating projects (excludes auto-generated fields)
export type ProjectInput = {
  name: string
  title: string
  description?: string
  status: string
  project_type: ProjectType
  organisation_ids?: string[]
  categories?: string[]
  priority?: 'low' | 'mid' | 'prio' | 'high prio'
  notes?: string
  firm_id?: number
}

// Database schema uses 'title' instead of 'name', and doesn't have 'priority' or 'notes'
export interface Project {
  id: string
  title: string  // Database column name
  name?: string  // Alias for title (for backward compatibility in UI)
  description?: string
  status: string  // Can be 'ongoing', 'done', 'failed', 'on-hold', or other values
  priority?: 'low' | 'mid' | 'prio' | 'high prio'  // Not in database, optional
  organisation_ids?: string[]
  categories: string[]
  notes?: string  // Not in database, optional
  project_type: ProjectType
  created_at?: string
  updated_at?: string
  // Additional database columns that exist but we don't use in UI:
  firm_id?: number  // Required in database (NOT NULL)
  category?: string  // Single category (different from categories array)
  needs?: string
  budget_range?: string
  timeline?: string
  is_anonymous?: boolean
  partner_needs?: string
  sectors?: string[]
}

/**
 * Check if the current user is an MB 2.0 user
 * This can be customized based on your authentication system
 */
export function isMB20User(): boolean {
  if (typeof window === 'undefined') return false
  
  // Check query parameter
  const params = new URLSearchParams(window.location.search)
  const userType = params.get('user_type')
  if (userType === 'mb-2.0') return true
  
  // Check localStorage
  const storedUserType = localStorage.getItem('mb_cockpit_user_type')
  if (storedUserType === 'mb-2.0') return true
  
  // Check hostname (if accessing from MB 2.0 domain)
  const hostname = window.location.hostname
  if (hostname.includes('mb-2-0') || hostname.includes('mb-2.0')) return true
  
  // Default to internal user
  return false
}

export async function getProjects(): Promise<Project[]> {
  // Return all projects - filtering will be done in UI based on selected tab
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    // Don't log configuration errors or empty error objects
    const isEmptyError = typeof error === 'object' && error !== null && Object.keys(error).length === 0;
    const isConfigError = error.code === 'PGRST_CONFIG_ERROR' || 
                         error.message === 'Supabase is not configured' ||
                         isEmptyError;
    if (!isConfigError) {
      console.error('Error fetching projects:', error)
    }
    return []
  }

  // Map database columns to our interface
  // Add 'name' alias for 'title' for backward compatibility
  return (data || []).map((project: any) => ({
    ...project,
    name: project.title, // Add name alias for UI compatibility
    categories: project.categories || [], // Ensure categories is always an array
    organisation_ids: project.organisation_ids || (project.organisation_id ? [project.organisation_id] : []), // Support both old and new format
  }))
}

export async function getProjectsByType(projectType: ProjectType): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('project_type', projectType)
    .order('created_at', { ascending: false })

  if (error) {
    // Don't log configuration errors or empty error objects
    const isEmptyError = typeof error === 'object' && error !== null && Object.keys(error).length === 0;
    const isConfigError = error.code === 'PGRST_CONFIG_ERROR' || 
                         error.message === 'Supabase is not configured' ||
                         isEmptyError;
    if (!isConfigError) {
      console.error('Error fetching projects by type:', error)
    }
    return []
  }

  // Map database columns to our interface
  // Add 'name' alias for 'title' for backward compatibility
  return (data || []).map((project: any) => ({
    ...project,
    name: project.title, // Add name alias for UI compatibility
    categories: project.categories || [], // Ensure categories is always an array
    organisation_ids: project.organisation_ids || (project.organisation_id ? [project.organisation_id] : []), // Support both old and new format
  }))
}

/**
 * Get a valid firm_id from existing projects or firms table
 */
async function getValidFirmId(): Promise<number | undefined> {
  // First, try to get firm_id from existing projects
  const { data: existingProjects } = await supabase
    .from('projects')
    .select('firm_id')
    .limit(1)
    .single()

  if (existingProjects?.firm_id) {
    return existingProjects.firm_id
  }

  // If no projects exist, try to get first firm_id from firms table
  const { data: firms } = await supabase
    .from('firms')
    .select('id')
    .limit(1)
    .single()

  if (firms?.id) {
    return firms.id
  }

  return undefined
}

export async function createProject(project: ProjectInput): Promise<Project | null> {
  // Get a valid firm_id if not provided
  let firmId = project.firm_id
  if (!firmId) {
    firmId = await getValidFirmId()
    if (!firmId) {
      console.error('No valid firm_id found. Please ensure there is at least one firm in the firms table or one project with a valid firm_id.')
      return null
    }
  }

  // Map UI fields to database columns
  const dbProject: any = {
    title: project.name || project.title, // Use name if provided, otherwise title
    description: project.description,
    status: project.status || 'ongoing',
    organisation_ids: project.organisation_ids || [],
    categories: project.categories || [],
    project_type: project.project_type,
    firm_id: firmId, // Use valid firm_id
    // Optional fields - only include if they have values
    ...(project.description && { description: project.description }),
  }

  // Remove fields that don't exist in database
  delete dbProject.name
  delete dbProject.priority
  delete dbProject.notes
  delete dbProject.organisation_id // Remove old single organisation_id field

  console.log('Creating project with data:', dbProject)
  const { data, error } = await supabase
    .from('projects')
    .insert([dbProject])
    .select()
    .single()

  if (error) {
    console.error('Error creating project:', error)
    console.error('Error details:', JSON.stringify(error, null, 2))
    return null
  }

  console.log('Project created successfully:', data)
  // Map back to our interface
  return {
    ...data,
    name: data.title,
    categories: data.categories || [],
    organisation_ids: data.organisation_ids || [],
  }
}

export async function updateProject(id: string, updates: Partial<Project>): Promise<Project | null> {
  // Map UI fields to database columns
  const dbUpdates: any = {}
  
  if (updates.name !== undefined) {
    dbUpdates.title = updates.name
  }
  if (updates.title !== undefined) {
    dbUpdates.title = updates.title
  }
  if (updates.description !== undefined) {
    dbUpdates.description = updates.description
  }
  if (updates.status !== undefined) {
    dbUpdates.status = updates.status
  }
  if (updates.organisation_ids !== undefined) {
    dbUpdates.organisation_ids = updates.organisation_ids
  }
  if (updates.categories !== undefined) {
    dbUpdates.categories = updates.categories
  }
  if (updates.project_type !== undefined) {
    dbUpdates.project_type = updates.project_type
  }

  dbUpdates.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('projects')
    .update(dbUpdates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating project:', error)
    return null
  }

  // Map back to our interface
  return {
    ...data,
    name: data.title,
    categories: data.categories || [],
    organisation_ids: data.organisation_ids || [],
  }
}

export async function deleteProject(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting project:', error)
    return false
  }

  return true
}

