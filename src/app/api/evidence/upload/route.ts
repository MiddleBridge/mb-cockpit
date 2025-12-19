import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import * as evidenceDb from '@/lib/db/evidence';

const EVIDENCE_BUCKET = 'evidence';

/**
 * Upload evidence file to storage and create evidence record
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const orgId = formData.get('orgId') as string;
    const projectId = formData.get('projectId') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!orgId || !projectId) {
      return NextResponse.json(
        { error: 'orgId and projectId are required' },
        { status: 400 }
      );
    }

    // Create evidence record first to get ID
    const evidence = await evidenceDb.createEvidence({
      org_id: orgId,
      project_id: projectId,
      file_name: file.name,
      storage_path: '', // Will update after upload
      mime_type: file.type || undefined,
      file_size: file.size || undefined,
    });

    if (!evidence) {
      return NextResponse.json(
        { error: 'Failed to create evidence record' },
        { status: 500 }
      );
    }

    // Generate storage path: org/{orgId}/projects/{projectId}/evidence/{yyyy}/{mm}/{evidenceId}-{filename}
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const fileExt = file.name.split('.').pop() || '';
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `org/${orgId}/projects/${projectId}/evidence/${year}/${month}/${evidence.id}-${sanitizedFileName}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(EVIDENCE_BUCKET)
      .upload(storagePath, file, {
        contentType: file.type || 'application/octet-stream',
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError || !uploadData) {
      // Clean up evidence record if upload fails
      await evidenceDb.deleteEvidence(evidence.id);
      console.error('Error uploading to Supabase Storage:', uploadError);
      return NextResponse.json(
        { error: uploadError?.message || 'Failed to upload file' },
        { status: 500 }
      );
    }

    // Update evidence record with storage path
    const { error: updateError } = await supabase
      .from('evidence')
      .update({ storage_path: storagePath })
      .eq('id', evidence.id);

    if (updateError) {
      console.error('Error updating evidence storage path:', updateError);
      // Don't fail the request, the file is uploaded
    }

    // Create link if linkType and linkId are provided
    const linkType = formData.get('linkType') as string | null;
    const linkId = formData.get('linkId') as string | null;

    if (linkType && linkId && (linkType === 'transaction' || linkType === 'note')) {
      await evidenceDb.createEvidenceLink({
        evidence_id: evidence.id,
        link_type: linkType as 'transaction' | 'note',
        link_id: linkId,
      });
    }

    return NextResponse.json({
      success: true,
      evidence: {
        ...evidence,
        storage_path: storagePath,
      },
    });
  } catch (error: any) {
    console.error('Error in evidence upload:', error);
    return NextResponse.json(
      { error: error.message || 'Upload failed' },
      { status: 500 }
    );
  }
}

