import { NextRequest, NextResponse } from 'next/server';
import { encryptString } from '@/lib/notion/encryption';
import { supabase } from '@/lib/supabase';

/**
 * Notion OAuth callback
 * GET /api/notion/oauth/callback?code=...&state=...
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    
    if (error) {
      return NextResponse.redirect(
        `${process.env.APP_BASE_URL || 'http://localhost:3000'}/settings?notion_error=${encodeURIComponent(error)}`
      );
    }
    
    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.APP_BASE_URL || 'http://localhost:3000'}/settings?notion_error=missing_code_or_state`
      );
    }
    
    // Decode state to get userEmail
    let userEmail: string;
    try {
      const decodedState = Buffer.from(state, 'base64').toString('utf8');
      const parts = decodedState.split(':');
      if (parts.length < 2) {
        throw new Error('Invalid state format');
      }
      userEmail = parts.slice(1).join(':'); // In case email contains ':'
    } catch (error) {
      return NextResponse.redirect(
        `${process.env.APP_BASE_URL || 'http://localhost:3000'}/settings?notion_error=invalid_state`
      );
    }
    
    // Exchange code for token
    const clientId = process.env.NOTION_CLIENT_ID;
    const clientSecret = process.env.NOTION_CLIENT_SECRET;
    const redirectUri = process.env.NOTION_REDIRECT_URI || 
                       `${process.env.APP_BASE_URL || 'http://localhost:3000'}/api/notion/oauth/callback`;
    
    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        `${process.env.APP_BASE_URL || 'http://localhost:3000'}/settings?notion_error=oauth_not_configured`
      );
    }
    
    // Notion OAuth uses HTTP Basic Auth with client_id:client_secret
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenResponse = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });
    
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      console.error('Notion token exchange error:', errorData);
      return NextResponse.redirect(
        `${process.env.APP_BASE_URL || 'http://localhost:3000'}/settings?notion_error=token_exchange_failed`
      );
    }
    
    const tokenData = await tokenResponse.json();
    
    // Extract workspace info from token response
    const workspaceId = tokenData.workspace_id || tokenData.owner?.workspace?.id;
    const workspaceName = tokenData.workspace_name || tokenData.owner?.workspace?.name;
    const botId = tokenData.bot_id;
    const ownerId = tokenData.owner?.user?.id;
    
    // Encrypt tokens
    const accessTokenEnc = encryptString(tokenData.access_token);
    const refreshTokenEnc = tokenData.refresh_token 
      ? encryptString(tokenData.refresh_token) 
      : null;
    
    // Store connection in database
    const { error: dbError } = await supabase
      .from('notion_connections')
      .upsert({
        user_email: userEmail,
        workspace_id: workspaceId,
        workspace_name: workspaceName,
        access_token_enc: accessTokenEnc,
        refresh_token_enc: refreshTokenEnc,
        token_type: tokenData.token_type,
        scope: tokenData.scope,
        notion_bot_id: botId,
        notion_owner_id: ownerId,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_email,workspace_id',
      });
    
    if (dbError) {
      console.error('Error storing Notion connection:', dbError);
      return NextResponse.redirect(
        `${process.env.APP_BASE_URL || 'http://localhost:3000'}/settings?notion_error=database_error`
      );
    }
    
    // Log audit event
    await supabase
      .from('notion_audit_events')
      .insert({
        user_email: userEmail,
        event_type: 'oauth_connected',
        metadata: { workspace_id: workspaceId, workspace_name: workspaceName },
      })
      .catch(err => console.error('Failed to log audit event:', err));
    
    return NextResponse.redirect(
      `${process.env.APP_BASE_URL || 'http://localhost:3000'}/settings?notion_connected=1`
    );
  } catch (error: any) {
    console.error('Error in Notion OAuth callback:', error);
    return NextResponse.redirect(
      `${process.env.APP_BASE_URL || 'http://localhost:3000'}/settings?notion_error=${encodeURIComponent(error.message)}`
    );
  }
}

