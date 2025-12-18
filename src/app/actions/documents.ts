'use server';

import { supabase } from '@/lib/supabase';

export interface DocumentLink {
  id: string;
  documentId: string;
  entityType: string;
  entityId: string;
  role: string;
  note?: string;
  createdAt: string;
  document: {
    id: string;
    title: string;
    docType: string;
    storagePath: string;
    fileName?: string;
    mimeType?: string;
    fileSizeBytes?: number;
    metadata: Record<string, any>;
    createdAt: string;
  };
}

export interface SearchDocumentsParams {
  orgId: string;
  query?: string;
  docType?: string;
  limit?: number;
}

/**
 * Upload document and optionally link to entity
 */
export async function uploadDocumentAndLinkToEntity(
  orgId: string,
  file: File,
  options: {
    docType?: string;
    title?: string;
    metadata?: Record<string, any>;
    entity?: {
      type: string;
      id: string;
      role?: string;
    };
  } = {}
): Promise<{ documentId: string; createdNew: boolean; storagePath: string; sha256: string }> {
  // Convert file to base64
  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');

  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/documents/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      orgId,
      docType: options.docType || 'OTHER',
      title: options.title || file.name,
      metadata: options.metadata || {},
      entity: options.entity || null,
      fileName: file.name,
      mimeType: file.type,
      fileBase64: base64,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to upload document');
  }

  return response.json();
}

/**
 * Link existing document to entity
 */
export async function linkExistingDocumentToEntity(
  orgId: string,
  documentId: string,
  entityType: string,
  entityId: string,
  role?: string,
  note?: string
): Promise<{ linkId: string }> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/documents/link`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'create',
      orgId,
      documentId,
      entityType,
      entityId,
      role: role || 'SUPPORTING',
      note,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create link');
  }

  const result = await response.json();
  return { linkId: result.linkId };
}

/**
 * Soft delete document link
 */
export async function softDeleteDocumentLink(
  orgId: string,
  linkId: string
): Promise<void> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/documents/link`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'delete',
      orgId,
      linkId,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete link');
  }
}

/**
 * Search documents by title, file_name, or metadata
 */
export async function searchDocuments(
  params: SearchDocumentsParams
): Promise<DocumentLink['document'][]> {
  const { orgId, query, docType, limit = 50 } = params;

  let queryBuilder = supabase
    .from('documents')
    .select('id, title, doc_type, storage_path, file_name, mime_type, file_size_bytes, file_size, metadata, created_at')
    .eq('organisation_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (query) {
    // Search in title, file_name, or metadata.invoice_no
    queryBuilder = queryBuilder.or(
      `title.ilike.%${query}%,file_name.ilike.%${query}%,metadata->>invoice_no.ilike.%${query}%`
    );
  }

  if (docType) {
    queryBuilder = queryBuilder.eq('doc_type', docType);
  }

  const { data, error } = await queryBuilder;

  if (error) {
    console.error('Error searching documents:', error);
    throw new Error('Failed to search documents');
  }

  return (data || []).map((doc) => ({
    id: doc.id,
    title: doc.title,
    docType: doc.doc_type,
    storagePath: doc.storage_path,
    fileName: doc.file_name || undefined,
    mimeType: doc.mime_type || undefined,
    fileSizeBytes: (doc as any).file_size_bytes || (doc as any).file_size || undefined,
    metadata: doc.metadata || {},
    createdAt: doc.created_at,
  }));
}

/**
 * Get document by ID
 */
export async function getDocumentById(documentId: string): Promise<DocumentLink['document'] | null> {
  const { data, error } = await supabase
    .from('documents')
    .select('id, title, doc_type, storage_path, file_name, mime_type, file_size_bytes, file_size, metadata, created_at')
    .eq('id', documentId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    console.error('Error getting document:', error);
    throw new Error('Failed to get document');
  }

  return {
    id: data.id,
    title: data.title,
    docType: data.doc_type,
    storagePath: data.storage_path,
    fileName: data.file_name || undefined,
    mimeType: data.mime_type || undefined,
    fileSizeBytes: (data as any).file_size_bytes || (data as any).file_size || undefined,
    metadata: data.metadata || {},
    createdAt: data.created_at,
  };
}

/**
 * Get all links for a document
 */
export async function getDocumentLinks(documentId: string): Promise<DocumentLink[]> {
  const { data, error } = await supabase
    .from('document_links')
      .select(`
      id,
      document_id,
      entity_type,
      entity_id,
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
    .eq('document_id', documentId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error getting document links:', error);
    throw new Error('Failed to get document links');
  }

  return (data || []).map((link: any) => ({
    id: link.id,
    documentId: link.document_id,
    entityType: link.entity_type,
    entityId: link.entity_id,
    role: link.role,
    note: link.note || undefined,
    createdAt: link.created_at,
    document: {
      id: link.documents.id,
      title: link.documents.title,
      docType: link.documents.doc_type,
      storagePath: link.documents.storage_path,
      fileName: link.documents.file_name || undefined,
      mimeType: link.documents.mime_type || undefined,
      fileSizeBytes: (link.documents as any).file_size_bytes || (link.documents as any).file_size || undefined,
      metadata: link.documents.metadata || {},
      createdAt: link.documents.created_at,
    },
  }));
}

