import { NextRequest, NextResponse } from 'next/server';
import { isGmailConnected } from '@/lib/gmail';

export async function GET(request: NextRequest) {
  try {
    const userEmail = request.nextUrl.searchParams.get('userEmail');
    
    if (!userEmail || userEmail.trim() === '') {
      return NextResponse.json(
        { error: 'Missing userEmail parameter' },
        { status: 400 }
      );
    }

    const connected = await isGmailConnected(userEmail.trim());
    
    console.log(`Gmail connection check for ${userEmail.trim()}: ${connected}`);
    
    return NextResponse.json({ connected });
  } catch (error: any) {
    console.error('Error checking Gmail connection:', error.message || 'Unknown error');
    
    return NextResponse.json(
      { error: 'Internal server error', connected: false },
      { status: 500 }
    );
  }
}

