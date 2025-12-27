import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * Manually trigger a sync for a Notion page
 * POST /api/notion/sync-now
 * Body: { userEmail: string, notionPageId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { userEmail, notionPageId } = await request.json();
    
    if (!userEmail || !notionPageId) {
      return NextResponse.json(
        { error: 'Missing required fields: userEmail, notionPageId' },
        { status: 400 }
      );
    }
    
    // Find notion_links to get entity info
    const { data: link } = await supabase
      .from('notion_links')
      .select('mb_entity_type, mb_entity_id')
      .eq('user_email', userEmail)
      .eq('notion_page_id', notionPageId)
      .single();
    
    // Upsert sync job
    const { error: jobError } = await supabase
      .from('notion_jobs')
      .upsert({
        user_email: userEmail,
        job_type: 'sync_page',
        notion_page_id: notionPageId,
        mb_entity_type: link?.mb_entity_type || null,
        mb_entity_id: link?.mb_entity_id || null,
        status: 'pending',
        attempts: 0,
        next_run_at: new Date().toISOString(),
      }, {
        onConflict: 'user_email,notion_page_id',
      });
    
    if (jobError) {
      return NextResponse.json(
        { error: 'Failed to enqueue sync job', details: jobError.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true, message: 'Sync job enqueued' });
  } catch (error: any) {
    console.error('Error enqueueing sync job:', error);
    return NextResponse.json(
      { error: 'Failed to enqueue sync job', details: error.message },
      { status: 500 }
    );
  }
}

