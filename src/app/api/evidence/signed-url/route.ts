import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const EVIDENCE_BUCKET = 'evidence';
const SIGNED_URL_EXPIRY = 3600; // 1 hour

/**
 * Get signed URL for evidence file
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const storagePath = searchParams.get('path');

    if (!storagePath) {
      return NextResponse.json(
        { error: 'path parameter is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.storage
      .from(EVIDENCE_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_EXPIRY);

    if (error) {
      console.error('Error creating signed URL:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to create signed URL' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      url: data.signedUrl,
      expiresIn: SIGNED_URL_EXPIRY,
    });
  } catch (error: any) {
    console.error('Error in signed URL generation:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate signed URL' },
      { status: 500 }
    );
  }
}

