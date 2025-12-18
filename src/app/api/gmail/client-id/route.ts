import { NextResponse } from 'next/server';

export async function GET() {
  const clientId = process.env.GMAIL_PUBLIC_GOOGLE_CLIENT_ID || 
                   process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
                   process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    return NextResponse.json(
      { error: 'Gmail Client ID not configured' },
      { status: 500 }
    );
  }

  return NextResponse.json({ clientId });
}

