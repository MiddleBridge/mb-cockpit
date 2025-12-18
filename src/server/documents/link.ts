import { supabase } from '@/lib/supabase';
import { isUuid } from '@/server/validators/isUuid';
import { getActiveOrgIdOrThrow } from '@/server/org/getActiveOrgId';

export interface CreateLinkParams {
  orgId?: string | null;
  documentId: string;
  entityType: string;
  entityId: string;
  role?: string;
  note?: string;
}

export interface DeleteLinkParams {
  orgId?: string | null;
  linkId: string;
}

/**
 * Create document link (server-side function, no HTTP)
 */
export async function createDocumentLink(
  params: CreateLinkParams
): Promise<{ linkId: string }> {
  const {
    orgId: providedOrgId,
    documentId,
    entityType,
    entityId,
    role = 'SUPPORTING',
    note,
  } = params;

  // Validate required fields
  if (!documentId || !entityType || !entityId) {
    throw new Error('Missing required fields: documentId, entityType, entityId');
  }

  // Get and validate orgId
  let orgId: string;
  try {
    orgId = await getActiveOrgIdOrThrow(providedOrgId);
  } catch (e: any) {
    throw new Error(e?.message || 'ORG_REQUIRED');
  }

  // Final UUID validation
  if (!isUuid(orgId) || !isUuid(documentId) || !isUuid(entityId)) {
    throw new Error('ORG_INVALID');
  }

  // Validate entity type
  const validEntityTypes = ['FINANCE_TRANSACTION', 'INVOICE', 'DEAL', 'ORGANISATION', 'CONTACT', 'PROJECT'];
  if (!validEntityTypes.includes(entityType)) {
    throw new Error(`Invalid entityType. Must be one of: ${validEntityTypes.join(', ')}`);
  }

  // Check if link already exists (active)
  const { data: existingLink } = await supabase
    .from('document_links')
    .select('id')
    .eq('organisation_id', orgId)
    .eq('document_id', documentId)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('is_deleted', false)
    .maybeSingle();

  if (existingLink) {
    throw new Error('Link already exists');
  }

  // Create link
  const { data: newLink, error: insertError } = await supabase
    .from('document_links')
    .insert({
      organisation_id: orgId,
      document_id: documentId,
      entity_type: entityType,
      entity_id: entityId,
      role: role,
      note: note || null,
      // created_by will be set from auth context in production
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('Error creating document link:', insertError);
    throw new Error(`Failed to create link: ${insertError.message}`);
  }

  return { linkId: newLink.id };
}

/**
 * Soft delete document link (server-side function, no HTTP)
 */
export async function deleteDocumentLink(
  params: DeleteLinkParams
): Promise<void> {
  const { orgId: providedOrgId, linkId } = params;

  if (!linkId) {
    throw new Error('Missing required field: linkId');
  }

  // Get and validate orgId
  let orgId: string;
  try {
    orgId = await getActiveOrgIdOrThrow(providedOrgId);
  } catch (e: any) {
    throw new Error(e?.message || 'ORG_REQUIRED');
  }

  // Final UUID validation
  if (!isUuid(orgId) || !isUuid(linkId)) {
    throw new Error('ORG_INVALID');
  }

  // Soft delete the link
  const { error: updateError } = await supabase
    .from('document_links')
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      // deleted_by will be set from auth context in production
    })
    .eq('id', linkId)
    .eq('organisation_id', orgId);

  if (updateError) {
    console.error('Error soft deleting document link:', updateError);
    throw new Error(`Failed to delete link: ${updateError.message}`);
  }
}

