import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import * as tripEvidenceDb from '@/features/finance-trips/db/trip-evidence';

const EVIDENCE_BUCKET = 'trip-evidence';

/**
 * Upload trip evidence file to storage and create evidence record
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const orgId = formData.get('orgId') as string;
    const tripId = formData.get('tripId') as string;
    const tripItemId = formData.get('tripItemId') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!orgId || !tripId) {
      return NextResponse.json(
        { error: 'orgId and tripId are required' },
        { status: 400 }
      );
    }

    // Create evidence record first to get ID
    const evidence = await tripEvidenceDb.createTripEvidence({
      org_id: orgId,
      trip_id: tripId,
      trip_item_id: tripItemId || null,
      file_name: file.name,
      mime_type: file.type || 'application/octet-stream',
      file_size: file.size || null,
      storage_bucket: EVIDENCE_BUCKET,
      storage_path: '', // Will update after upload
    });

    if (!evidence) {
      return NextResponse.json(
        { error: 'Failed to create evidence record' },
        { status: 500 }
      );
    }

    // Generate storage path: org/{orgId}/trips/{tripId}/{yyyy}/{mm}/{evidenceId}-{filename}
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const fileExt = file.name.split('.').pop() || '';
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `org/${orgId}/trips/${tripId}/${year}/${month}/${evidence.id}-${sanitizedFileName}`;

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
      await tripEvidenceDb.deleteTripEvidence(evidence.id);
      console.error('Error uploading to Supabase Storage:', uploadError);
      return NextResponse.json(
        { error: uploadError?.message || 'Failed to upload file' },
        { status: 500 }
      );
    }

    // Update evidence record with storage path
    const { error: updateError } = await supabase
      .from('finance_trip_evidence')
      .update({ storage_path: storagePath })
      .eq('id', evidence.id);

    if (updateError) {
      console.error('Error updating evidence storage path:', updateError);
      // Don't fail the request, the file is uploaded
    }

    return NextResponse.json({
      success: true,
      evidence: {
        ...evidence,
        storage_path: storagePath,
      },
    });
  } catch (error: any) {
    console.error('Error in trip evidence upload:', error);
    return NextResponse.json(
      { error: error.message || 'Upload failed' },
      { status: 500 }
    );
  }
}

