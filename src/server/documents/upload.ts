import { createHash } from 'crypto';
import { validateOrgId, getActiveOrgIdOrThrow } from '@/server/org/getActiveOrgId';
import { isUuid } from '@/server/validators/isUuid';
import { createServerSupabaseClient } from '@/server/supabase/server';

/**
 * Derive document name from available sources
 * Always returns a non-empty string (never null/undefined)
 */
function deriveDocumentName(input: {
  explicitName?: string | null;
  originalFilename?: string | null;
  fallbackFilename?: string | null;
  type?: string | null;
}): string {
  const raw =
    input.explicitName?.trim() ||
    input.originalFilename?.trim() ||
    input.fallbackFilename?.trim();

  if (raw) return raw;

  // Ultimate fallback to ensure never null/empty
  return input.type ? `${input.type} document` : 'Untitled document';
}

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
  import?: {
    ok: true;
    parsed: number;
    valid: number;
    invalid: number;
    upserted: number;
  } | {
    ok: false;
    step: string;
    error: string;
    extra?: any;
  };
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
        console.error('❌ [UPLOAD] Storage upload error:', {
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

    // Get public URL for file_url (required field, NOT NULL)
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(storagePath);

    const file_url = urlData?.publicUrl;

    if (!file_url || !file_url.trim()) {
      console.error('❌ [UPLOAD] file_url missing after upload', { bucket: bucketName, path: storagePath });
      return {
        ok: false,
        error: {
          code: 'UPLOAD_FAILED',
          message: 'Nie udało się wygenerować URL pliku po uploadzie',
        },
      };
    }

    // Derive document name (required field, never null)
    const documentName = deriveDocumentName({
      explicitName: title,
      originalFilename: fileName,
      fallbackFilename: storagePath?.split('/').pop() || null,
      type: docType,
    });

    // Prepare insert payload with all required fields
    const insertPayload = {
      name: documentName, // Required: NOT NULL field
      organisation_id: orgId, // Required: NOT NULL field
      file_url: file_url, // Required: NOT NULL field (public URL to file)
      storage_path: storagePath,
      doc_type: docType,
      mime_type: mimeType,
      file_name: fileName, // Original filename from user
      file_size_bytes: fileSize,
      sha256: sha256,
      title: title || documentName, // Display name (can be different from name)
      metadata: metadata || {},
      // created_by will be set from auth context in production
      // For now, allow NULL for backward compatibility
    };

    // Hard validation before insert (fail fast with clear errors)
    if (!insertPayload.name || !insertPayload.name.trim()) {
      console.error('❌ [UPLOAD] Validation failed: name empty');
      return {
        ok: false,
        error: {
          code: 'UPLOAD_FAILED',
          message: 'Nie udało się utworzyć rekordu dokumentu: brak nazwy dokumentu',
        },
      };
    }

    if (!insertPayload.organisation_id) {
      console.error('❌ [UPLOAD] Validation failed: orgId missing');
      return {
        ok: false,
        error: {
          code: 'UPLOAD_FAILED',
          message: 'Nie udało się utworzyć rekordu dokumentu: brak organizacji',
        },
      };
    }

    if (!insertPayload.storage_path || !insertPayload.storage_path.trim()) {
      console.error('❌ [UPLOAD] Validation failed: path missing');
      return {
        ok: false,
        error: {
          code: 'UPLOAD_FAILED',
          message: 'Nie udało się utworzyć rekordu dokumentu: brak ścieżki do pliku',
        },
      };
    }

    if (!insertPayload.file_url || !insertPayload.file_url.trim()) {
      console.error('❌ [UPLOAD] Validation failed: file_url missing');
      return {
        ok: false,
        error: {
          code: 'UPLOAD_FAILED',
          message: 'Nie udało się utworzyć rekordu dokumentu: brak URL pliku',
        },
      };
    }

    // Insert document record
    // Log only safe fields (no sensitive data like fileBase64, metadata content, etc.)
    console.log('💾 [UPLOAD] Inserting document:', {
      name: insertPayload.name,
      orgId: insertPayload.organisation_id,
      path: insertPayload.storage_path,
      type: insertPayload.doc_type,
      file_url: insertPayload.file_url,
      fileName: insertPayload.file_name,
      fileSize: insertPayload.file_size_bytes,
    });

    const { data: newDoc, error: insertError } = await supabase
      .from('documents')
      .insert(insertPayload)
      .select('id')
      .single();

    if (insertError) {
      console.error('❌ [UPLOAD] Insert error:', {
        error: insertError.message,
        code: insertError.code,
        details: insertError.details,
        hint: insertError.hint,
        insertPayload: {
          name: insertPayload.name,
          orgId: insertPayload.organisation_id,
          path: insertPayload.storage_path,
          file_url: insertPayload.file_url,
        },
      });
      return {
        ok: false,
        error: {
          code: 'UPLOAD_FAILED',
          message: `Nie udało się utworzyć rekordu dokumentu: ${insertError.message}`,
        },
      };
    }

    console.log('✅ [UPLOAD] Document inserted successfully:', { documentId: newDoc.id });

    documentId = newDoc.id;
    createdNew = true;

    // If this is a bank statement (BANK_CONFIRMATION), process it to extract transactions
    let importResult: { ok: true; parsed: number; valid: number; invalid: number; upserted: number } | { ok: false; step: string; error: string; extra?: any } | null = null;

    if (docType === 'BANK_CONFIRMATION' && documentId) {
      console.info('[BANK_STATEMENT] upload done', {
        documentId: newDoc.id,
        organisation_id: orgId,
        storage_path: storagePath,
        file_url: insertPayload.file_url,
      });

      try {
        const { processBankStatementDocument } = await import('@/lib/finance/processBankStatementDocument');
        importResult = await processBankStatementDocument({ documentId: newDoc.id });
        console.info('[BANK_STATEMENT] import result', importResult);
      } catch (processError: any) {
        console.error('[BANK_STATEMENT] import error', processError);
        importResult = {
          ok: false,
          step: 'import_exception',
          error: processError?.message || 'Unknown error',
        };
      }
    }
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
      import: importResult || undefined,
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

