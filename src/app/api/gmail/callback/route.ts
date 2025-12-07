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

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code)

    if (!tokens.access_token || !tokens.refresh_token || !tokens.expiry_date) {
      return NextResponse.json(
        { error: 'Failed to get tokens from Google' },
        { status: 500 }
      )
    }

    // Store tokens in database
    const success = await storeTokens(userEmail, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date,
    })

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to store tokens' },
        { status: 500 }
      )
    }

    // Redirect back to home or timeline page
    const redirectUrl = process.env.GOOGLE_REDIRECT_URI?.includes('localhost')
      ? 'http://localhost:3000'
      : process.env.NEXT_PUBLIC_APP_URL || '/'

    return NextResponse.redirect(`${redirectUrl}?gmail_connected=true`)
  } catch (error: any) {
    console.error('Error in Gmail callback:', error)
    return NextResponse.json(
      { error: 'Failed to complete Gmail authentication', details: error.message },
      { status: 500 }
    )
  }
}

