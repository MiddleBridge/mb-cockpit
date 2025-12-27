import { NextRequest, NextResponse } from 'next/server';
import { getNotionClientForUser } from '@/lib/notion/client';
import { supabase } from '@/lib/supabase';
import { extractPageTitle } from '@/lib/notion/blocksToMarkdown';

/**
 * Create a Notion page for an MB entity
 * POST /api/notion/create-note
 * Body: { userEmail: string, mbEntityType: string, mbEntityId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { userEmail, mbEntityType, mbEntityId } = await request.json();
    
    if (!userEmail || !mbEntityType || !mbEntityId) {
      return NextResponse.json(
        { error: 'Missing required fields: userEmail, mbEntityType, mbEntityId' },
        { status: 400 }
      );
    }
    
    if (!['contact', 'organisation', 'project', 'document'].includes(mbEntityType)) {
      return NextResponse.json(
        { error: 'Invalid mbEntityType. Must be one of: contact, organisation, project, document' },
        { status: 400 }
      );
    }
    
    // Get Notion connection
    const { data: connection, error: connError } = await supabase
      .from('notion_connections')
      .select('*')
      .eq('user_email', userEmail)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (connError || !connection) {
      return NextResponse.json(
        { error: 'Notion not connected. Please connect your Notion account first.' },
        { status: 401 }
      );
    }
    
    // Get user's Notion parent configuration (database or data source)
    const notionParentId = connection.notion_parent_id || process.env.NOTION_DEFAULT_DATABASE_ID;
    const notionParentType = (connection.notion_parent_type || 'database') as 'database' | 'data_source';
    
    if (!notionParentId) {
      return NextResponse.json(
        { error: 'Notion parent not configured. Please set up a database or data source for MB Notes.' },
        { status: 400 }
      );
    }
    
    // Get entity details for page title and properties
    let entityName = 'Untitled';
    let entityUrl = '';
    
    try {
      const entityTable = mbEntityType === 'organisation' ? 'organisations' :
                          mbEntityType === 'project' ? 'projects' :
                          mbEntityType === 'document' ? 'documents' : 'contacts';
      
      const { data: entity } = await supabase
        .from(entityTable)
        .select('id, name')
        .eq('id', mbEntityId)
        .single();
      
      if (entity) {
        entityName = entity.name || 'Untitled';
        entityUrl = `${process.env.APP_BASE_URL || 'http://localhost:3000'}/${mbEntityType}s/${mbEntityId}`;
      }
    } catch (error) {
      console.warn('Failed to fetch entity details:', error);
    }
    
    // Create Notion client
    const client = await getNotionClientForUser(userEmail);
    
    // Resolve parent (handle data_sources migration)
    const parent = await client.resolveParent(notionParentType as 'database' | 'data_source', notionParentId);
    
    // Create page in Notion
    const pageData = {
      parent: parent.type === 'data_source' 
        ? { data_source_id: parent.id }
        : { database_id: parent.id },
      properties: {
        // Title property (adjust based on your Notion database schema)
        'Name': {
          title: [
            {
              text: {
                content: entityName,
              },
            },
          ],
        },
        // MB back-pointers
        'MB Entity Type': {
          select: {
            name: mbEntityType,
          },
        },
        'MB Entity ID': {
          rich_text: [
            {
              text: {
                content: mbEntityId,
              },
            },
          ],
        },
        'MB URL': {
          url: entityUrl,
        },
      },
    };
    
    const notionPage = await client.createPage(pageData);
    
    // Store notion_links record
    const { error: linkError } = await supabase
      .from('notion_links')
      .insert({
        user_email: userEmail,
        mb_entity_type: mbEntityType,
        mb_entity_id: mbEntityId,
        notion_page_id: notionPage.id,
        notion_url: notionPage.url,
        notion_parent_type: parent.type,
        notion_parent_id: parent.id,
      });
    
    if (linkError) {
      console.error('Error storing notion_links:', linkError);
      // Page was created in Notion, but link storage failed
      // Consider cleaning up the Notion page or retrying
    }
    
    // Log audit event
    await supabase
      .from('notion_audit_events')
      .insert({
        user_email: userEmail,
        event_type: 'page_created',
        notion_page_id: notionPage.id,
        mb_entity_type: mbEntityType,
        mb_entity_id: mbEntityId,
      })
      .catch(err => console.error('Failed to log audit event:', err));
    
    // Enqueue initial sync job
    await supabase
      .from('notion_jobs')
      .insert({
        user_email: userEmail,
        job_type: 'sync_page',
        notion_page_id: notionPage.id,
        mb_entity_type: mbEntityType,
        mb_entity_id: mbEntityId,
        status: 'pending',
        next_run_at: new Date().toISOString(),
      })
      .catch(err => console.error('Error enqueueing sync job:', err));
    
    return NextResponse.json({
      success: true,
      notionPageId: notionPage.id,
      notionUrl: notionPage.url,
    });
  } catch (error: any) {
    console.error('Error creating Notion note:', error);
    return NextResponse.json(
      { error: 'Failed to create Notion note', details: error.message },
      { status: 500 }
    );
  }
}

