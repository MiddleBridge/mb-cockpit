import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

interface CreateLinkRequest {
  orgId: string;
  documentId: string;
  entityType: string;
  entityId: string;
  role?: string;
  note?: string;
}

interface DeleteLinkRequest {
  orgId: string;
  linkId: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'create') {
      const linkData: CreateLinkRequest = body;
      const {
        orgId,
        documentId,
        entityType,
        entityId,
        role = 'SUPPORTING',
        note,
      } = linkData;

      // Validate required fields
      if (!orgId || !documentId || !entityType || !entityId) {
        return NextResponse.json(
          { error: 'Missing required fields: orgId, documentId, entityType, entityId' },
          { status: 400 }
        );
      }

      // Validate entity type
      const validEntityTypes = ['FINANCE_TRANSACTION', 'INVOICE', 'DEAL', 'ORGANISATION', 'CONTACT', 'PROJECT'];
      if (!validEntityTypes.includes(entityType)) {
        return NextResponse.json(
          { error: `Invalid entityType. Must be one of: ${validEntityTypes.join(', ')}` },
          { status: 400 }
        );
      }

      // Check if link already exists (active)
      const { data: existingLink } = await supabase
        .from('document_links')
        .select('id')
        .eq('organisation_id', orgId)
        .eq('document_id', documentId)
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .eq('is_deleted', false)
        .maybeSingle();

      if (existingLink) {
        return NextResponse.json(
          { error: 'Link already exists', linkId: existingLink.id },
          { status: 409 }
        );
      }

      // Create link
      const { data: newLink, error: insertError } = await supabase
        .from('document_links')
        .insert({
          organisation_id: orgId,
          document_id: documentId,
          entity_type: entityType,
          entity_id: entityId,
          role: role,
          note: note || null,
          // created_by will be set from auth context in production
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('Error creating document link:', insertError);
        return NextResponse.json(
          { error: 'Failed to create link', details: insertError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        linkId: newLink.id,
      });
    } else if (action === 'delete') {
      const deleteData: DeleteLinkRequest = body;
      const { orgId, linkId } = deleteData;

      if (!orgId || !linkId) {
        return NextResponse.json(
          { error: 'Missing required fields: orgId, linkId' },
          { status: 400 }
        );
      }

      // Soft delete the link
      const { error: updateError } = await supabase
        .from('document_links')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          // deleted_by will be set from auth context in production
        })
        .eq('id', linkId)
        .eq('organisation_id', orgId);

      if (updateError) {
        console.error('Error soft deleting document link:', updateError);
        return NextResponse.json(
          { error: 'Failed to delete link', details: updateError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Must be "create" or "delete"' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Error in documents link:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

