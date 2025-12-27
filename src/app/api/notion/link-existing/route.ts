import { NextRequest, NextResponse } from 'next/server';
import { getNotionClientForUser } from '@/lib/notion/client';
import { supabase } from '@/lib/supabase';

/**
 * Link an existing Notion page to an MB entity
 * POST /api/notion/link-existing
 * Body: { userEmail: string, mbEntityType: string, mbEntityId: string, notionPageUrl: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { userEmail, mbEntityType, mbEntityId, notionPageUrl } = await request.json();
    
    if (!userEmail || !mbEntityType || !mbEntityId || !notionPageUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: userEmail, mbEntityType, mbEntityId, notionPageUrl' },
        { status: 400 }
      );
    }
    
    if (!['contact', 'organisation', 'project', 'document'].includes(mbEntityType)) {
      return NextResponse.json(
        { error: 'Invalid mbEntityType. Must be one of: contact, organisation, project, document' },
        { status: 400 }
      );
    }
    
    // Extract page ID from Notion URL
    // Format: https://www.notion.so/workspace/Page-Title-PAGE_ID
    // Or: https://www.notion.so/PAGE_ID
    let pageId = '';
    try {
      const url = new URL(notionPageUrl);
      const pathParts = url.pathname.split('-');
      pageId = pathParts[pathParts.length - 1];
      
      // Validate it looks like a Notion ID (32 char hex)
      if (!/^[a-f0-9]{32}$/i.test(pageId)) {
        throw new Error('Invalid Notion page ID format');
      }
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid Notion page URL format' },
        { status: 400 }
      );
    }
    
    // Get Notion client and verify access
    const client = await getNotionClientForUser(userEmail);
    
    try {
      const page = await client.getPage(pageId);
      
      // Determine parent type from page
      const parentType = page.parent.type === 'data_source_id' ? 'data_source' : 'database';
      const parentId = page.parent.data_source_id || page.parent.database_id || '';
      
      // Store notion_links record
      const { error: linkError } = await supabase
        .from('notion_links')
        .upsert({
          user_email: userEmail,
          mb_entity_type: mbEntityType,
          mb_entity_id: mbEntityId,
          notion_page_id: pageId,
          notion_url: page.url,
          notion_parent_type: parentType,
          notion_parent_id: parentId,
        }, {
          onConflict: 'user_email,mb_entity_type,mb_entity_id',
        });
      
      if (linkError) {
        console.error('Error storing notion_links:', linkError);
        return NextResponse.json(
          { error: 'Failed to store link', details: linkError.message },
          { status: 500 }
        );
      }
      
      // Log audit event
      const { error: auditError } = await supabase
        .from('notion_audit_events')
        .insert({
          user_email: userEmail,
          event_type: 'page_linked',
          notion_page_id: pageId,
          mb_entity_type: mbEntityType,
          mb_entity_id: mbEntityId,
        });
      if (auditError) {
        console.error('Failed to log audit event:', auditError);
      }
      
      // Enqueue initial sync job
      const { error: jobError } = await supabase
        .from('notion_jobs')
        .insert({
          user_email: userEmail,
          job_type: 'sync_page',
          notion_page_id: pageId,
          mb_entity_type: mbEntityType,
          mb_entity_id: mbEntityId,
          status: 'pending',
          next_run_at: new Date().toISOString(),
        });
      if (jobError) {
        console.error('Error enqueueing sync job:', jobError);
      }
      
      return NextResponse.json({
        success: true,
        notionPageId: pageId,
        notionUrl: page.url,
      });
    } catch (error: any) {
      if (error.status === 404) {
        return NextResponse.json(
          { error: 'Notion page not found or you do not have access to it' },
          { status: 404 }
        );
      }
      if (error.status === 401 || error.status === 403) {
        return NextResponse.json(
          { error: 'Not authorized to access this Notion page. Please reconnect your Notion account.' },
          { status: 401 }
        );
      }
      throw error;
    }
  } catch (error: any) {
    console.error('Error linking existing Notion page:', error);
    return NextResponse.json(
      { error: 'Failed to link Notion page', details: error.message },
      { status: 500 }
    );
  }
}

