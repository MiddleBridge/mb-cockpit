import { google } from 'googleapis'
import { supabase } from './supabase'

const OAuth2Client = google.auth.OAuth2Client

export function getOAuthClient(): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Missing Google OAuth credentials. Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI environment variables.')
  }

  return new OAuth2Client(clientId, clientSecret, redirectUri)
}

export function getAuthUrl(userEmail: string): string {
  const oauth2Client = getOAuthClient()

  const scopes = [
    'https://www.googleapis.com/auth/gmail.readonly',
  ]

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    state: userEmail, // Pass user email in state for callback
    prompt: 'consent', // Force consent screen to get refresh token
  })

  return authUrl
}

export async function storeTokens(
  userEmail: string,
  tokens: {
    access_token: string | null | undefined
    refresh_token: string | null | undefined
    expiry_date: number | null | undefined
  }
): Promise<boolean> {
  if (!tokens.access_token || !tokens.refresh_token || !tokens.expiry_date) {
    throw new Error('Missing required tokens')
  }

  const expiryDate = new Date(tokens.expiry_date)

  // Upsert into gmail_credentials
  const { error } = await supabase
    .from('gmail_credentials')
    .upsert({
      user_email: userEmail,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: expiryDate.toISOString(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_email',
    })

  if (error) {
    console.error('Error storing Gmail tokens:', error)
    return false
  }

  return true
}

export async function getAuthorizedGmailClient(userEmail: string) {
  const oauth2Client = getOAuthClient()

  // Load tokens from database
  const { data, error } = await supabase
    .from('gmail_credentials')
    .select('*')
    .eq('user_email', userEmail)
    .single()

  if (error || !data) {
    throw new Error('Gmail not connected. Please connect your Gmail account first.')
  }

  oauth2Client.setCredentials({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expiry_date: new Date(data.expiry_date).getTime(),
  })

  // Check if token is expired and refresh if needed
  const now = new Date()
  const expiryDate = new Date(data.expiry_date)

  if (now >= expiryDate) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken()
      
      // Update tokens in database
      if (credentials.access_token && credentials.refresh_token && credentials.expiry_date) {
        await storeTokens(userEmail, {
          access_token: credentials.access_token,
          refresh_token: credentials.refresh_token,
          expiry_date: credentials.expiry_date,
        })

        oauth2Client.setCredentials(credentials)
      }
    } catch (refreshError) {
      console.error('Error refreshing Gmail token:', refreshError)
      throw new Error('Failed to refresh Gmail token. Please reconnect your Gmail account.')
    }
  }

  return google.gmail({ version: 'v1', auth: oauth2Client })
}

