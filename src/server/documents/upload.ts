import { createHash } from 'crypto';
import { validateOrgId, getActiveOrgIdOrThrow } from '@/server/org/getActiveOrgId';
import { isUuid } from '@/server/validators/isUuid';
import { createServerSupabaseClient } from '@/server/supabase/server';

export interface UploadDocumentParams {
  orgId?: string | null;
  docType?: string;
  title?: string | null;
  metadata?: Record<string, any> | null;
  entity?: {
    type: string;
    id: string;
    role?: string;
  } | null;
  fileName: string;
  mimeType: string;
  fileBase64: string;
}

export interface UploadDocumentResult {
  documentId: string;
  createdNew: boolean;
  storagePath: string;
  sha256: string;
}

export type UploadDocumentError = 
  | { code: 'ORG_REQUIRED'; message: string }
  | { code: 'ORG_INVALID'; message: string }
  | { code: 'ORG_FETCH_FAILED'; message: string }
  | { code: 'MISSING_FIELDS'; message: string }
  | { code: 'UPLOAD_FAILED'; message: string };

/**
 * Upload document (server-side function, no HTTP)
 * Returns result or error object
 */
export async function uploadDocument(
  params: UploadDocumentParams
): Promise<{ ok: true; data: UploadDocumentResult } | { ok: false; error: UploadDocumentError }> {
  try {
    // Debug logging for production
    if (process.env.VERCEL) {
      const { getBaseUrl, assertProdBaseUrl } = await import('@/server/http/baseUrl');
      const baseUrl = await getBaseUrl();
      console.log('DEBUG uploadDocument baseUrl', { baseUrl, vercel: !!process.env.VERCEL });
      assertProdBaseUrl(baseUrl);
    }

    const {
      orgId: providedOrgId,
      docType = 'OTHER',
      title,
      metadata = {},
      entity,
      fileName,
      mimeType,
      fileBase64,
    } = params;

    // Validate required fields
    if (!fileName || !mimeType || !fileBase64) {
      return {
        ok: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Missing required fields: fileName, mimeType, fileBase64',
        },
      };
    }

    // Get and validate orgId
    let orgId: string;
    try {
      orgId = await getActiveOrgIdOrThrow(providedOrgId);
    } catch (e: any) {
      const errorCode = e?.message || 'ORG_REQUIRED';
      return {
        ok: false,
        error: {
          code: errorCode as UploadDocumentError['code'],
          message: errorCode === 'ORG_REQUIRED' 
            ? 'Wybierz organizację przed uploadem.'
            : errorCode === 'ORG_INVALID'
            ? 'Nieprawidłowy identyfikator organizacji.'
            : 'Nie udało się pobrać organizacji.',
        },
      };
    }

    // Final UUID validation (safety check)
    if (!isUuid(orgId)) {
      return {
        ok: false,
        error: {
          code: 'ORG_INVALID',
          message: 'Nieprawidłowy identyfikator organizacji (UUID).',
        },
      };
    }

  // Decode base64 file
  const fileBuffer = Buffer.from(fileBase64, 'base64');
  const fileSize = fileBuffer.length;

  // Compute SHA256 hash
  const sha256 = createHash('sha256').update(fileBuffer).digest('hex');

  // Create server-side Supabase client with service role key
  const supabase = createServerSupabaseClient();

  // Check if document with same (orgId, sha256) already exists
  const { data: existingDoc, error: checkError } = await supabase
    .from('documents')
    .select('id, storage_path')
    .eq('organisation_id', orgId)
    .eq('sha256', sha256)
    .maybeSingle();

  if (checkError && checkError.code !== 'PGRST_CONFIG_ERROR') {
    console.error('Error checking existing document:', checkError);
    return {
      ok: false,
      error: {
        code: 'UPLOAD_FAILED',
        message: `Nie udało się sprawdzić istniejącego dokumentu: ${checkError.message}`,
      },
    };
  }

  let documentId: string;
  let createdNew = false;
  let storagePath: string;

  if (existingDoc) {
    // Document already exists, return existing
    documentId = existingDoc.id;
    storagePath = existingDoc.storage_path || '';
  } else {
    // Upload new file to storage
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    // Generate UUID v4
    const fileUuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
    
    // Sanitize filename
    const sanitizedFileName = fileName
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_');
    
    const storagePathTemplate = `documents/${orgId}/${year}/${month}/${fileUuid}-${sanitizedFileName}`;
    storagePath = storagePathTemplate;

    // Upload to Supabase Storage
    // Bucket is hardcoded to 'mb-cockpit' (documents is a folder inside mb-cockpit)
    const bucketName = 'mb-cockpit';
    
    console.log('📤 [UPLOAD] Uploading to bucket:', bucketName, 'path:', storagePath);
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: false, // Don't overwrite if exists
      });

    if (uploadError) {
      // If file already exists in storage, that's okay - we'll use existing path
      if (uploadError.message?.includes('already exists') || 
          uploadError.message?.includes('The resource already exists') ||
          uploadError.message?.includes('duplicate')) {
        // File exists, continue with insert
      } else {
        console.error('❌ [UPLOAD] Upload error:', {
          bucket: bucketName,
          path: storagePath,
          error: uploadError.message,
        });
        return {
          ok: false,
          error: {
            code: 'UPLOAD_FAILED',
            message: `Nie udało się przesłać pliku: ${uploadError.message}`,
          },
        };
      }
    }

    // Insert document record
    const documentTitle = title || fileName;
    const { data: newDoc, error: insertError } = await supabase
      .from('documents')
      .insert({
        organisation_id: orgId,
        title: documentTitle,
        doc_type: docType,
        storage_path: storagePath,
        sha256: sha256,
        mime_type: mimeType,
        file_name: fileName,
        file_size_bytes: fileSize,
        metadata: metadata || {},
        // created_by will be set from auth context in production
        // For now, allow NULL for backward compatibility
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Error inserting document:', insertError);
      return {
        ok: false,
        error: {
          code: 'UPLOAD_FAILED',
          message: `Nie udało się utworzyć rekordu dokumentu: ${insertError.message}`,
        },
      };
    }

    documentId = newDoc.id;
    createdNew = true;
  }

  // Optionally create link if entity is provided
  if (entity && documentId) {
    const { error: linkError } = await supabase
      .from('document_links')
      .insert({
        organisation_id: orgId,
        document_id: documentId,
        entity_type: entity.type,
        entity_id: entity.id,
        role: entity.role || 'SUPPORTING',
        // created_by will be set from auth context in production
      });

    if (linkError) {
      // Log but don't fail - document is created, link can be created later
      console.error('Error creating document link:', linkError);
    }
  }

  return {
    ok: true,
    data: {
      documentId,
      createdNew,
      storagePath,
      sha256,
    },
  };
  } catch (error: any) {
    console.error('Error in uploadDocument:', error);
    return {
      ok: false,
      error: {
        code: 'UPLOAD_FAILED',
        message: error?.message || 'Nieznany błąd podczas przesyłania dokumentu',
      },
    };
  }
}

