import { supabase } from '@/lib/supabase';

export interface TransactionDocument {
  linkId: string;
  documentId: string;
  title: string;
  docType: string;
  storagePath: string;
  fileName?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  metadata: Record<string, any>;
  role: string;
  note?: string;
  createdAt: string;
  linkedAt: string;
}

/**
 * List all documents linked to a finance transaction
 */
export async function listTransactionDocuments(
  orgId: string,
  transactionId: string
): Promise<TransactionDocument[]> {
  const { data, error } = await supabase
    .from('document_links')
      .select(`
      id,
      document_id,
      role,
      note,
      created_at,
      documents (
        id,
        title,
        doc_type,
        storage_path,
        file_name,
        mime_type,
        file_size_bytes,
        file_size,
        metadata,
        created_at
      )
    `)
    .eq('organisation_id', orgId)
    .eq('entity_type', 'FINANCE_TRANSACTION')
    .eq('entity_id', transactionId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error listing transaction documents:', error);
    throw new Error('Failed to list transaction documents');
  }

  return (data || []).map((link: any) => ({
    linkId: link.id,
    documentId: link.document_id,
    title: link.documents.title,
    docType: link.documents.doc_type,
    storagePath: link.documents.storage_path,
    fileName: link.documents.file_name || undefined,
    mimeType: link.documents.mime_type || undefined,
    fileSizeBytes: (link.documents as any).file_size_bytes || (link.documents as any).file_size || undefined,
    metadata: link.documents.metadata || {},
    role: link.role,
    note: link.note || undefined,
    createdAt: link.documents.created_at,
    linkedAt: link.created_at,
  }));
}

/**
 * Create a link between a document and a finance transaction
 */
export async function createTransactionDocumentLink(
  orgId: string,
  transactionId: string,
  documentId: string,
  role: string = 'SUPPORTING'
): Promise<{ linkId: string }> {
  const { data, error } = await supabase
    .from('document_links')
    .insert({
      organisation_id: orgId,
      document_id: documentId,
      entity_type: 'FINANCE_TRANSACTION',
      entity_id: transactionId,
      role: role,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating transaction document link:', error);
    throw new Error('Failed to create transaction document link');
  }

  return { linkId: data.id };
}

/**
 * Remove (soft delete) a document link from a transaction
 */
export async function removeTransactionDocumentLink(
  orgId: string,
  linkId: string
): Promise<void> {
  const { error } = await supabase
    .from('document_links')
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
    })
    .eq('id', linkId)
    .eq('organisation_id', orgId);

  if (error) {
    console.error('Error removing transaction document link:', error);
    throw new Error('Failed to remove transaction document link');
  }
}

