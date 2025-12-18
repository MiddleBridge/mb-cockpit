import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createHash } from 'crypto';

interface UploadRequest {
  orgId: string;
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

interface UploadResponse {
  documentId: string;
  createdNew: boolean;
  storagePath: string;
  sha256: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: UploadRequest = await request.json();
    const {
      orgId,
      docType = 'OTHER',
      title,
      metadata = {},
      entity,
      fileName,
      mimeType,
      fileBase64,
    } = body;

    // Validate required fields
    if (!orgId || !fileName || !mimeType || !fileBase64) {
      return NextResponse.json(
        { error: 'Missing required fields: orgId, fileName, mimeType, fileBase64' },
        { status: 400 }
      );
    }

    // Decode base64 file
    const fileBuffer = Buffer.from(fileBase64, 'base64');
    const fileSize = fileBuffer.length;

    // Compute SHA256 hash
    const sha256 = createHash('sha256').update(fileBuffer).digest('hex');

    // Check if document with same (orgId, sha256) already exists
    const { data: existingDoc, error: checkError } = await supabase
      .from('documents')
      .select('id, storage_path')
      .eq('organisation_id', orgId)
      .eq('sha256', sha256)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST_CONFIG_ERROR') {
      console.error('Error checking existing document:', checkError);
      return NextResponse.json(
        { error: 'Failed to check existing document', details: checkError.message },
        { status: 500 }
      );
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
      const bucketName = 'documents';
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
          console.error('Error uploading file:', uploadError);
          return NextResponse.json(
            { error: 'Failed to upload file to storage', details: uploadError.message },
            { status: 500 }
          );
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
        return NextResponse.json(
          { error: 'Failed to create document record', details: insertError.message },
          { status: 500 }
        );
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

    const response: UploadResponse = {
      documentId,
      createdNew,
      storagePath,
      sha256,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Error in documents upload:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

