import { NextRequest, NextResponse } from 'next/server';
import { storeTokens } from '@/lib/gmail';

export async function POST(request: NextRequest) {
  try {
    const { userEmail, accessToken, expiresIn } = await request.json();

    if (!userEmail || !accessToken) {
      return NextResponse.json(
        { error: 'Missing userEmail or accessToken' },
        { status: 400 }
      );
    }

    // Calculate expiry date (expiresIn is in seconds)
    const expiryDate = new Date();
    expiryDate.setSeconds(expiryDate.getSeconds() + (expiresIn || 3600));

    // For frontend OAuth, we don't get refresh_token, so we'll store what we have
    // Note: This means tokens will expire and user will need to reconnect
    // For production, you should use backend OAuth flow to get refresh_token
    try {
      const success = await storeTokens(userEmail, {
        access_token: accessToken,
        refresh_token: undefined, // Frontend OAuth doesn't provide refresh_token
        expiry_date: expiryDate.getTime(),
      });

      if (!success) {
        return NextResponse.json(
          { error: 'Failed to store tokens (storeTokens returned false)' },
          { status: 500 }
        );
      }
    } catch (storeError: any) {
      console.error('storeTokens threw error:', storeError);
      return NextResponse.json(
        { error: 'Failed to store tokens', details: storeError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error storing Gmail tokens:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

