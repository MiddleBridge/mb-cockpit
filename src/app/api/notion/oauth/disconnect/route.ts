import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * Disconnect Notion integration
 * POST /api/notion/oauth/disconnect
 * Body: { userEmail: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { userEmail } = await request.json();
    
    if (!userEmail) {
      return NextResponse.json(
        { error: 'Missing userEmail' },
        { status: 400 }
      );
    }
    
    // Delete connection and cascade delete links/notes
    // Note: We'll mark links as disconnected rather than deleting them
    // to preserve history
    
    const { error: connectionError } = await supabase
      .from('notion_connections')
      .delete()
      .eq('user_email', userEmail);
    
    if (connectionError) {
      console.error('Error deleting Notion connection:', connectionError);
      return NextResponse.json(
        { error: 'Failed to disconnect Notion', details: connectionError.message },
        { status: 500 }
      );
    }
    
    // Log audit event
    await supabase
      .from('notion_audit_events')
      .insert({
        user_email: userEmail,
        event_type: 'oauth_disconnected',
      })
      .catch(err => console.error('Failed to log audit event:', err));
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error disconnecting Notion:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Notion', details: error.message },
      { status: 500 }
    );
  }
}

