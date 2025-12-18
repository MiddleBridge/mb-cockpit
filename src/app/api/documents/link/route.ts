import { NextRequest, NextResponse } from 'next/server';
import { createDocumentLink, deleteDocumentLink } from '@/server/documents/link';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'create') {
      const result = await createDocumentLink(body);
      return NextResponse.json({
        success: true,
        linkId: result.linkId,
      });
    } else if (action === 'delete') {
      await deleteDocumentLink(body);
      return NextResponse.json({
        success: true,
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Must be "create" or "delete"' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Error in documents link:', error);
    const status = error.message?.includes('Missing required fields') || 
                   error.message?.includes('Invalid') ? 400 :
                   error.message?.includes('already exists') ? 409 : 500;
    return NextResponse.json(
      { error: error.message || 'Internal server error', details: error.message },
      { status }
    );
  }
}

