import { NextRequest, NextResponse } from 'next/server';
import { uploadDocument } from '@/server/documents/upload';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await uploadDocument(body);
    
    if (!result.ok) {
      const status = result.error.code === 'MISSING_FIELDS' ? 400 : 500;
      return NextResponse.json(
        { error: result.error.message, code: result.error.code },
        { status }
      );
    }
    
    return NextResponse.json(result.data);
  } catch (error: any) {
    console.error('Error in documents upload:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

