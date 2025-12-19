import { supabase } from '../supabase'

export interface Evidence {
  id: string
  org_id: string
  project_id: string
  file_name: string
  storage_path: string
  mime_type?: string
  file_size?: number
  uploaded_by?: string
  created_at?: string
}

export interface EvidenceLink {
  id: string
  evidence_id: string
  link_type: 'transaction' | 'note' | 'project'
  link_id: string
  created_at?: string
}

export interface EvidenceWithLinks extends Evidence {
  links?: EvidenceLink[]
}

/**
 * Get evidence for a project
 */
export async function getEvidenceByProject(projectId: string): Promise<EvidenceWithLinks[]> {
  const { data, error } = await supabase
    .from('evidence')
    .select(`
      *,
      evidence_links (*)
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching evidence:', error)
    return []
  }

  return (data || []).map((item: any) => ({
    ...item,
    links: item.evidence_links || [],
  }))
}

/**
 * Get evidence linked to a transaction
 */
export async function getEvidenceByTransaction(transactionId: string): Promise<EvidenceWithLinks[]> {
  const { data, error } = await supabase
    .from('evidence_links')
    .select(`
      evidence_id,
      evidence (*)
    `)
    .eq('link_type', 'transaction')
    .eq('link_id', transactionId)

  if (error) {
    console.error('Error fetching evidence by transaction:', error)
    return []
  }

  return (data || []).map((item: any) => ({
    ...item.evidence,
    links: [{ evidence_id: item.evidence_id, link_type: 'transaction' as const, link_id: transactionId }],
  }))
}

/**
 * Get evidence linked to a note (timeline item)
 */
export async function getEvidenceByNote(noteId: string): Promise<EvidenceWithLinks[]> {
  const { data, error } = await supabase
    .from('evidence_links')
    .select(`
      evidence_id,
      evidence (*)
    `)
    .eq('link_type', 'note')
    .eq('link_id', noteId)

  if (error) {
    console.error('Error fetching evidence by note:', error)
    return []
  }

  return (data || []).map((item: any) => ({
    ...item.evidence,
    links: [{ evidence_id: item.evidence_id, link_type: 'note' as const, link_id: noteId }],
  }))
}

/**
 * Create evidence record
 */
export async function createEvidence(
  evidence: Omit<Evidence, 'id' | 'created_at'>
): Promise<Evidence | null> {
  const { data, error } = await supabase
    .from('evidence')
    .insert([evidence])
    .select()
    .single()

  if (error) {
    console.error('Error creating evidence:', error)
    return null
  }

  return data
}

/**
 * Create evidence link
 */
export async function createEvidenceLink(
  link: Omit<EvidenceLink, 'id' | 'created_at'>
): Promise<EvidenceLink | null> {
  const { data, error } = await supabase
    .from('evidence_links')
    .insert([link])
    .select()
    .single()

  if (error) {
    console.error('Error creating evidence link:', error)
    return null
  }

  return data
}

/**
 * Delete evidence link
 */
export async function deleteEvidenceLink(
  evidenceId: string,
  linkType: 'transaction' | 'note' | 'project',
  linkId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('evidence_links')
    .delete()
    .eq('evidence_id', evidenceId)
    .eq('link_type', linkType)
    .eq('link_id', linkId)

  if (error) {
    console.error('Error deleting evidence link:', error)
    return false
  }

  return true
}

/**
 * Delete evidence and all its links
 */
export async function deleteEvidence(evidenceId: string): Promise<boolean> {
  // Delete links first (cascade should handle this, but let's be explicit)
  const { error: linksError } = await supabase
    .from('evidence_links')
    .delete()
    .eq('evidence_id', evidenceId)

  if (linksError) {
    console.error('Error deleting evidence links:', linksError)
    return false
  }

  // Delete evidence record
  const { error } = await supabase
    .from('evidence')
    .delete()
    .eq('id', evidenceId)

  if (error) {
    console.error('Error deleting evidence:', error)
    return false
  }

  return true
}

