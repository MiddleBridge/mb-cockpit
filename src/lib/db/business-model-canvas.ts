import { supabase } from '../supabase'

export type PlatformObjectType = 'contact' | 'organisation' | 'document' | 'task'

export interface PlatformObject {
  type: PlatformObjectType
  id: string
  name?: string
}

export interface BusinessModelCanvas {
  id: string
  project_name: string
  customer_segments: string
  customer_segments_org_ids?: string[] // Legacy, kept for backward compatibility
  customer_segments_objects?: PlatformObject[]
  value_propositions: string
  channels: string
  channels_org_ids?: string[] // Legacy
  channels_objects?: PlatformObject[]
  customer_relationships: string
  customer_relationships_org_ids?: string[] // Legacy
  customer_relationships_objects?: PlatformObject[]
  revenue_streams: string
  revenue_streams_org_ids?: string[] // Legacy
  revenue_streams_objects?: PlatformObject[]
  key_resources: string
  key_resources_org_ids?: string[] // Legacy
  key_resources_objects?: PlatformObject[]
  key_activities: string
  key_activities_org_ids?: string[] // Legacy
  key_activities_objects?: PlatformObject[]
  key_partnerships: string
  key_partnerships_org_ids?: string[] // Legacy
  key_partnerships_objects?: PlatformObject[]
  cost_structure: string
  cost_structure_org_ids?: string[] // Legacy
  cost_structure_objects?: PlatformObject[]
  created_at?: string
  updated_at?: string
}

export async function getBusinessModelCanvas(projectName: string = 'Middle Bridge 2.0'): Promise<BusinessModelCanvas | null> {
  const { data, error } = await supabase
    .from('business_model_canvas')
    .select('*')
    .eq('project_name', projectName)
    .maybeSingle()

  if (error) {
    console.error('Error fetching business model canvas:', error)
    return null
  }

  return data
}

export async function createOrUpdateBusinessModelCanvas(
  canvas: Omit<BusinessModelCanvas, 'id' | 'created_at' | 'updated_at'>
): Promise<BusinessModelCanvas> {
  // First check if it exists
  const existing = await getBusinessModelCanvas(canvas.project_name)
  
  if (existing) {
    // Update existing
    const { data, error } = await supabase
      .from('business_model_canvas')
      .update({
        ...canvas,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating business model canvas:', error)
      throw new Error(`Failed to update business model canvas: ${error.message}`)
    }

    if (!data) {
      throw new Error('Failed to update business model canvas: No data returned')
    }

    return data
  } else {
    // Create new
    const { data, error } = await supabase
      .from('business_model_canvas')
      .insert([canvas])
      .select()
      .single()

    if (error) {
      console.error('Error creating business model canvas:', error)
      throw new Error(`Failed to create business model canvas: ${error.message}`)
    }

    if (!data) {
      throw new Error('Failed to create business model canvas: No data returned')
    }

    return data
  }
}

