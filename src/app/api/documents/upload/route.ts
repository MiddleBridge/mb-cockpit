import { NextRequest, NextResponse } from 'next/server';
import { uploadDocument } from '@/server/documents/upload';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await uploadDocument(body);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in documents upload:', error);
    const status = error.message?.includes('Missing required fields') ? 400 : 500;
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status }
    );
  }
}

