import { NextRequest, NextResponse } from 'next/server'
import { getOAuthClient, storeTokens } from '../../../../lib/gmail'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state') // userEmail passed in state

    if (!code) {
      return NextResponse.json(
        { error: 'Missing authorization code' },
        { status: 400 }
      )
    }

    if (!state) {
      return NextResponse.json(
        { error: 'Missing state parameter (userEmail)' },
        { status: 400 }
      )
    }

    const userEmail = state
    const oauth2Client = getOAuthClient()

    // Log redirect URI being used
    // Use getBaseUrl for production, fallback to env or localhost for dev
    const { getBaseUrl } = await import('@/server/http/baseUrl');
    const baseUrl = getBaseUrl();
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 
                        process.env.GMAIL_REDIRECT_URI ||
                        `${baseUrl}/api/gmail/callback`;
    console.log('🔍 Callback: Using redirect URI:', redirectUri);
    console.log('🔍 Callback: Base URL:', baseUrl);
    console.log('🔍 Callback: Received code:', code ? 'yes' : 'no')

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code)

    if (!tokens.access_token || !tokens.refresh_token || !tokens.expiry_date) {
      return NextResponse.json(
        { error: 'Failed to get tokens from Google' },
        { status: 500 }
      )
    }

    // Store tokens in database
    console.log('🔍 Callback: Storing tokens for userEmail:', userEmail);
    console.log('🔍 Callback: Token data:', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null
    });
    
    try {
      const success = await storeTokens(userEmail, {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date,
      })

      if (!success) {
        console.error('❌ Callback: storeTokens returned false');
        return NextResponse.json(
          { error: 'Failed to store tokens' },
          { status: 500 }
        )
      }
      
      console.log('✅ Callback: Tokens stored successfully');
    } catch (storeError: any) {
      console.error('❌ Callback: Error storing tokens:', storeError);
      return NextResponse.json(
        { error: 'Failed to store tokens', details: storeError.message },
        { status: 500 }
      )
    }

    // Redirect back to home or timeline page
    // Use absolute URL from request origin
    const origin = request.nextUrl.origin
    const redirectUrl = `${origin}/?gmail_connected=true&userEmail=${encodeURIComponent(userEmail)}`
    
    console.log('🔍 Callback: Redirecting to:', redirectUrl)
    
    return NextResponse.redirect(redirectUrl)
  } catch (error: any) {
    console.error('Error in Gmail callback:', error)
    return NextResponse.json(
      { error: 'Failed to complete Gmail authentication', details: error.message },
      { status: 500 }
    )
  }
}

