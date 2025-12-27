import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * Start Notion OAuth flow
 * GET /api/notion/oauth/start?userEmail=user@example.com
 */
export async function GET(request: NextRequest) {
  try {
    const userEmail = request.nextUrl.searchParams.get('userEmail');
    
    if (!userEmail) {
      return NextResponse.json(
        { error: 'Missing userEmail parameter' },
        { status: 400 }
      );
    }
    
    const clientId = process.env.NOTION_CLIENT_ID;
    const redirectUri = process.env.NOTION_REDIRECT_URI || 
                       `${process.env.APP_BASE_URL || 'http://localhost:3000'}/api/notion/oauth/callback`;
    
    if (!clientId) {
      return NextResponse.json(
        { error: 'Notion OAuth not configured. Missing NOTION_CLIENT_ID' },
        { status: 500 }
      );
    }
    
    // Generate state token (CSRF protection)
    const state = crypto.randomBytes(32).toString('hex');
    
    // Store state temporarily (in production, use Redis or database)
    // For now, we'll include userEmail in state and validate in callback
    const stateWithEmail = `${state}:${userEmail}`;
    const encodedState = Buffer.from(stateWithEmail).toString('base64');
    
    // Build OAuth URL
    const authUrl = new URL('https://api.notion.com/v1/oauth/authorize');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('owner', 'user');
    authUrl.searchParams.set('state', encodedState);
    
    return NextResponse.redirect(authUrl.toString());
  } catch (error: any) {
    console.error('Error starting Notion OAuth:', error);
    return NextResponse.json(
      { error: 'Failed to start OAuth flow', details: error.message },
      { status: 500 }
    );
  }
}

