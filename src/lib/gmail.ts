import { google } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'
import { supabase } from './supabase'

export function getOAuthClient(): OAuth2Client {
  // Try multiple possible env variable names for client ID
  const clientId = process.env.GMAIL_PUBLIC_GOOGLE_CLIENT_ID || 
                   process.env.GOOGLE_CLIENT_ID || 
                   process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || 
                       process.env.GMAIL_GOOGLE_CLIENT_SECRET ||
                       process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET
  // Use environment variable or construct from base URL
  // For server-side, prefer getBaseUrl(), but allow env override
  let redirectUri = process.env.GOOGLE_REDIRECT_URI || process.env.GMAIL_REDIRECT_URI;
  
  if (!redirectUri) {
    // Fallback: use localhost for development
    // In production, GOOGLE_REDIRECT_URI should be set explicitly
    redirectUri = 'http://localhost:3000/api/gmail/callback';
  }

  if (!clientId) {
    throw new Error('Missing Google OAuth Client ID. Please set GMAIL_PUBLIC_GOOGLE_CLIENT_ID (or GOOGLE_CLIENT_ID) in .env')
  }

  if (!clientSecret) {
    throw new Error('Missing Google OAuth Client Secret. Please set GOOGLE_CLIENT_SECRET, GMAIL_GOOGLE_CLIENT_SECRET, or NEXT_PUBLIC_GOOGLE_CLIENT_SECRET in .env')
  }

  // Log which env vars were used (without exposing secrets)
  console.log('🔍 OAuth Client Config:', {
    clientIdSource: process.env.GMAIL_PUBLIC_GOOGLE_CLIENT_ID ? 'GMAIL_PUBLIC_GOOGLE_CLIENT_ID' :
                    process.env.GOOGLE_CLIENT_ID ? 'GOOGLE_CLIENT_ID' :
                    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ? 'NEXT_PUBLIC_GOOGLE_CLIENT_ID' : 'none',
    clientIdPrefix: clientId.substring(0, 20) + '...',
    clientSecretSource: process.env.GOOGLE_CLIENT_SECRET ? 'GOOGLE_CLIENT_SECRET' :
                         process.env.GMAIL_GOOGLE_CLIENT_SECRET ? 'GMAIL_GOOGLE_CLIENT_SECRET' :
                         process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET ? 'NEXT_PUBLIC_GOOGLE_CLIENT_SECRET' : 'none',
    redirectUri,
  })

  return new OAuth2Client(clientId, clientSecret, redirectUri)
}

export function getAuthUrl(userEmail: string): string {
  const oauth2Client = getOAuthClient()

  const scopes = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/calendar.events',
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
    refresh_token?: string | null | undefined
    expiry_date: number | null | undefined
  }
): Promise<boolean> {
  if (!tokens.access_token || !tokens.expiry_date) {
    throw new Error('Missing required tokens (access_token and expiry_date)')
  }

  const expiryDate = new Date(tokens.expiry_date)

  // Upsert into gmail_credentials
  // Note: If refresh_token column is NOT NULL, we'll use empty string as fallback
  console.log('🔍 storeTokens: Storing for userEmail:', userEmail);
  console.log('🔍 storeTokens: Token data:', {
    hasAccessToken: !!tokens.access_token,
    accessTokenLength: tokens.access_token?.length || 0,
    hasRefreshToken: !!tokens.refresh_token,
    expiryDate: expiryDate.toISOString(),
  });

  const { data: upsertData, error } = await supabase
    .from('gmail_credentials')
    .upsert({
      user_email: userEmail,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || '', // Use empty string if column doesn't allow NULL
      expiry_date: expiryDate.toISOString(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_email',
    })
    .select()

  console.log('🔍 storeTokens: Upsert result:', { upsertData, error });

  if (error) {
    console.error('Error storing Gmail tokens:', error)
    console.error('Error details:', JSON.stringify(error, null, 2))
    // Check if table doesn't exist
    if (error.code === 'PGRST116' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
      throw new Error('gmail_credentials table does not exist. Please run the migration to create it.')
    }
    // Check if column doesn't allow null
    if (error.code === '23502' || error.message?.includes('null value')) {
      throw new Error('refresh_token column does not allow null. Please update the table schema to allow null.')
    }
    throw new Error(`Database error: ${error.message || JSON.stringify(error)}`)
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

/**
 * Get access token for a user (for API calls that need just the token)
 */
export async function getAccessToken(userEmail: string): Promise<string | null> {
  console.log('🔍 getAccessToken: Getting token for:', userEmail);
  try {
    // Load tokens from database directly (no OAuth client needed for frontend OAuth)
    const { data, error } = await supabase
      .from('gmail_credentials')
      .select('access_token, refresh_token, expiry_date')
      .eq('user_email', userEmail)
      .single()

    console.log('🔍 getAccessToken: Database response:', { hasData: !!data, error });

    if (error || !data) {
      console.warn('⚠️ getAccessToken: No data or error:', error);
      return null
    }

    if (!data.access_token || data.access_token.trim() === '') {
      console.warn('⚠️ getAccessToken: Empty access_token');
      return null;
    }

    // Check if token is expired
    const now = new Date()
    const expiryDate = new Date(data.expiry_date)
    const isExpired = now >= expiryDate;

    console.log('🔍 getAccessToken: Token status:', {
      isExpired,
      now: now.toISOString(),
      expiryDate: expiryDate.toISOString(),
      hasRefreshToken: !!data.refresh_token && data.refresh_token.trim() !== '',
    });

    // If expired and we have refresh_token, try to refresh (backend OAuth)
    if (isExpired && data.refresh_token && data.refresh_token.trim() !== '') {
      console.log('🔄 getAccessToken: Token expired, attempting refresh...');
      try {
        const oauth2Client = getOAuthClient()
        oauth2Client.setCredentials({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expiry_date: expiryDate.getTime(),
        })

        const { credentials } = await oauth2Client.refreshAccessToken()
        
        // Update tokens in database
        if (credentials.access_token && credentials.refresh_token && credentials.expiry_date) {
          await storeTokens(userEmail, {
            access_token: credentials.access_token,
            refresh_token: credentials.refresh_token,
            expiry_date: credentials.expiry_date,
          })
        }

        console.log('✅ getAccessToken: Token refreshed successfully');
        return credentials.access_token || null
      } catch (refreshError) {
        console.error('❌ getAccessToken: Error refreshing token:', refreshError);
        // For frontend OAuth, if refresh fails, return null (user needs to reconnect)
        return null
      }
    }

    // If expired but no refresh_token (frontend OAuth), token is invalid
    if (isExpired) {
      console.warn('⚠️ getAccessToken: Token expired and no refresh_token (frontend OAuth)');
      return null;
    }

    console.log('✅ getAccessToken: Returning valid token');
    return data.access_token
  } catch (error) {
    console.error('❌ getAccessToken: Exception:', error)
    return null
  }
}

/**
 * Check if Gmail is connected for a user
 */
export async function isGmailConnected(userEmail: string): Promise<boolean> {
  console.log('🔍 isGmailConnected: Checking for userEmail:', userEmail);
  try {
    const { data, error } = await supabase
      .from('gmail_credentials')
      .select('user_email, access_token, refresh_token, expiry_date')
      .eq('user_email', userEmail)
      .single()

    console.log('🔍 isGmailConnected: Supabase response:', { data, error });

    if (error) {
      // Don't log configuration errors
      if (error.code !== 'PGRST116' && error.code !== 'PGRST_CONFIG_ERROR' && error.message !== 'Supabase is not configured') {
        console.error('❌ Error checking Gmail connection:', error);
      }
      if (error.code === 'PGRST116') {
        console.warn('⚠️ No record found in gmail_credentials for:', userEmail);
      }
      return false;
    }

    // Check if we have access_token (not empty)
    const hasToken = !!data && !!data.access_token && data.access_token.trim() !== '';
    console.log('🔍 isGmailConnected: Has token?', hasToken, 'Token length:', data?.access_token?.length || 0);
    return hasToken;
  } catch (err: any) {
    console.error('❌ Exception checking Gmail connection:', err);
    return false;
  }
}

