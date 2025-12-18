import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const userEmail = request.nextUrl.searchParams.get('userEmail')
    
    if (!userEmail) {
      return NextResponse.json(
        { error: 'Missing userEmail parameter' },
        { status: 400 }
      )
    }

    const debugInfo: any = {
      userEmail: userEmail.trim(),
      checks: {}
    }

    // Check if gmail_credentials table exists and has data
    try {
      const { data: credentials, error: credError } = await supabase
        .from('gmail_credentials')
        .select('*')
        .eq('user_email', userEmail.trim())
        .maybeSingle()

      debugInfo.checks.gmail_credentials = {
        exists: !credError || credError.code !== 'PGRST116',
        hasData: !!credentials,
        error: credError ? {
          code: credError.code,
          message: credError.message
        } : null,
        data: credentials ? {
          hasAccessToken: !!credentials.access_token,
          accessTokenLength: credentials.access_token?.length || 0,
          hasRefreshToken: !!credentials.refresh_token && credentials.refresh_token.trim() !== '',
          expiryDate: credentials.expiry_date,
          isExpired: credentials.expiry_date ? new Date() >= new Date(credentials.expiry_date) : null
        } : null
      }
    } catch (err: any) {
      debugInfo.checks.gmail_credentials = {
        error: err.message
      }
    }

    // Check if gmail_messages table exists
    try {
      const { data: messages, error: msgError } = await supabase
        .from('gmail_messages')
        .select('count')
        .eq('user_email', userEmail.trim())
        .limit(1)

      debugInfo.checks.gmail_messages = {
        exists: !msgError || msgError.code !== 'PGRST116',
        error: msgError ? {
          code: msgError.code,
          message: msgError.message
        } : null
      }
    } catch (err: any) {
      debugInfo.checks.gmail_messages = {
        error: err.message
      }
    }

    // Check if gmail_attachments table exists
    try {
      const { data: attachments, error: attError } = await supabase
        .from('gmail_attachments')
        .select('count')
        .eq('user_email', userEmail.trim())
        .limit(1)

      debugInfo.checks.gmail_attachments = {
        exists: !attError || attError.code !== 'PGRST116',
        error: attError ? {
          code: attError.code,
          message: attError.message
        } : null
      }
    } catch (err: any) {
      debugInfo.checks.gmail_attachments = {
        error: err.message
      }
    }

    return NextResponse.json(debugInfo, { status: 200 })
  } catch (error: any) {
    console.error('Error in debug endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

