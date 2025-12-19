import { supabase } from '../supabase'

export interface TimelineAttachment {
  id: string
  timeline_item_id: string
  file_name: string
  file_url: string
  mime_type?: string
  created_at?: string
}

export interface TimelineItem {
  id: string
  organisation_id?: string
  contact_id?: string
  project_id?: string
  type: 'note' | 'task' | 'email' | 'file' | 'meeting'
  title: string
  body?: string
  direction?: 'inbound' | 'outbound'
  status?: 'open' | 'done'
  external_source?: string
  external_id?: string
  happened_at: string
  created_by?: string
  created_at?: string
  attachments?: TimelineAttachment[]
}

export interface TimelineItemInput {
  organisationId?: string
  contactId?: string
  projectId?: string
  type: 'note' | 'task' | 'email' | 'file' | 'meeting'
  title: string
  body?: string
  direction?: 'inbound' | 'outbound'
  status?: 'open' | 'done'
  externalSource?: string
  externalId?: string
  happenedAt?: string
}

export interface TimelineAttachmentInput {
  timelineItemId: string
  fileName: string
  fileUrl: string
  mimeType?: string
}

export async function getTimelineItemsForOrganisation(
  organisationId: string,
  limit = 100
): Promise<TimelineItem[]> {
  const { data, error } = await supabase
    .from('timeline_items')
    .select(`
      *,
      timeline_attachments (*)
    `)
    .eq('organisation_id', organisationId)
    .order('happened_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    // Don't log configuration errors or empty error objects
    const isEmptyError = typeof error === 'object' && error !== null && Object.keys(error).length === 0;
    const isConfigError = error.code === 'PGRST_CONFIG_ERROR' || 
                         error.message === 'Supabase is not configured' ||
                         isEmptyError;
    if (!isConfigError) {
      console.error('Error fetching timeline items for organisation:', error)
    }
    return []
  }

  return (data || []).map((item: any) => ({
    ...item,
    attachments: item.timeline_attachments || [],
  }))
}

export async function getTimelineItemsForContact(
  contactId: string,
  limit = 100
): Promise<TimelineItem[]> {
  const { data, error } = await supabase
    .from('timeline_items')
    .select(`
      *,
      timeline_attachments (*)
    `)
    .eq('contact_id', contactId)
    .order('happened_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    // Don't log configuration errors or empty error objects
    const isEmptyError = typeof error === 'object' && error !== null && Object.keys(error).length === 0;
    const isConfigError = error.code === 'PGRST_CONFIG_ERROR' || 
                         error.message === 'Supabase is not configured' ||
                         isEmptyError;
    if (!isConfigError) {
      console.error('Error fetching timeline items for contact:', error)
    }
    return []
  }

  return (data || []).map((item: any) => ({
    ...item,
    attachments: item.timeline_attachments || [],
  }))
}

export async function getTimelineItemsForProject(
  projectId: string,
  limit = 100
): Promise<TimelineItem[]> {
  const { data, error } = await supabase
    .from('timeline_items')
    .select(`
      *,
      timeline_attachments (*)
    `)
    .eq('project_id', projectId)
    .order('happened_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    // Don't log configuration errors or empty error objects
    const isEmptyError = typeof error === 'object' && error !== null && Object.keys(error).length === 0;
    const isConfigError = error.code === 'PGRST_CONFIG_ERROR' || 
                         error.message === 'Supabase is not configured' ||
                         isEmptyError;
    if (!isConfigError) {
      console.error('Error fetching timeline items for project:', error)
    }
    return []
  }

  return (data || []).map((item: any) => ({
    ...item,
    attachments: item.timeline_attachments || [],
  }))
}

export async function createTimelineItem(
  input: TimelineItemInput
): Promise<TimelineItem | null> {
  const dbItem: any = {
    organisation_id: input.organisationId || null,
    contact_id: input.contactId || null,
    project_id: input.projectId || null,
    type: input.type,
    title: input.title,
    body: input.body || null,
    direction: input.direction || null,
    status: input.status || null,
    external_source: input.externalSource || null,
    external_id: input.externalId || null,
    happened_at: input.happenedAt || new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('timeline_items')
    .insert([dbItem])
    .select()
    .single()

  if (error) {
    console.error('Error creating timeline item:', error)
    return null
  }

  return {
    ...data,
    attachments: [],
  }
}

export async function addAttachmentToTimelineItem(
  input: TimelineAttachmentInput
): Promise<TimelineAttachment | null> {
  const dbAttachment: any = {
    timeline_item_id: input.timelineItemId,
    file_name: input.fileName,
    file_url: input.fileUrl,
    mime_type: input.mimeType || null,
  }

  const { data, error } = await supabase
    .from('timeline_attachments')
    .insert([dbAttachment])
    .select()
    .single()

  if (error) {
    console.error('Error adding attachment to timeline item:', error)
    return null
  }

  return data
}

export async function updateTimelineItem(
  id: string,
  updates: Partial<TimelineItemInput>
): Promise<TimelineItem | null> {
  const dbUpdates: any = {}

  if (updates.title !== undefined) dbUpdates.title = updates.title
  if (updates.body !== undefined) dbUpdates.body = updates.body
  if (updates.status !== undefined) dbUpdates.status = updates.status
  if (updates.direction !== undefined) dbUpdates.direction = updates.direction
  if (updates.happenedAt !== undefined) dbUpdates.happened_at = updates.happenedAt

  const { data, error } = await supabase
    .from('timeline_items')
    .update(dbUpdates)
    .eq('id', id)
    .select(`
      *,
      timeline_attachments (*)
    `)
    .single()

  if (error) {
    console.error('Error updating timeline item:', error)
    return null
  }

  return {
    ...data,
    attachments: data.timeline_attachments || [],
  }
}

export async function deleteTimelineItem(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('timeline_items')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting timeline item:', error)
    return false
  }

  return true
}

