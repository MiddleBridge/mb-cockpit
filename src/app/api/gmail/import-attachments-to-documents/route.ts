import { NextRequest, NextResponse } from 'next/server'
import { importAttachmentAsDocument, type GmailAttachmentRow, type GmailMessageRow } from '@/lib/gmail-sync'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { userEmail } = await request.json()
    
    if (!userEmail || userEmail.trim() === '') {
      return NextResponse.json(
        { error: 'Missing userEmail parameter' },
        { status: 400 }
      )
    }
    
    const trimmedEmail = userEmail.trim()
    
    // Find all attachments that haven't been imported yet
    // (no document exists with matching source_gmail_attachment_id)
    const { data: unattachedAttachments, error: attachmentsError } = await supabase
      .from('gmail_attachments')
      .select('*')
      .eq('user_email', trimmedEmail)
    
    if (attachmentsError) {
      return NextResponse.json(
        { error: 'Failed to fetch attachments', details: attachmentsError.message },
        { status: 500 }
      )
    }
    
    if (!unattachedAttachments || unattachedAttachments.length === 0) {
      console.log('📭 No attachments found in gmail_attachments table')
      return NextResponse.json({
        success: true,
        documentsCreated: 0,
        documents: [],
        reason: 'No attachments found in database'
      })
    }
    
    console.log(`📦 Found ${unattachedAttachments.length} attachments in database`)
    
    // Check which attachments already have documents
    const attachmentIds = unattachedAttachments.map(a => a.gmail_attachment_id)
    const { data: existingDocuments, error: existingDocsError } = await supabase
      .from('documents')
      .select('source_gmail_attachment_id')
      .in('source_gmail_attachment_id', attachmentIds)
    
    if (existingDocsError) {
      console.error('❌ Error checking existing documents:', existingDocsError)
    }
    
    const existingAttachmentIds = new Set(
      (existingDocuments || []).map(d => d.source_gmail_attachment_id).filter(Boolean)
    )
    
    console.log(`📋 Found ${existingAttachmentIds.size} attachments already imported`)
    
    // Filter to only unattached attachments
    const toImport = unattachedAttachments.filter(
      a => !existingAttachmentIds.has(a.gmail_attachment_id)
    )
    
    console.log(`🔄 ${toImport.length} attachments ready to import`)
    
    if (toImport.length === 0) {
      return NextResponse.json({
        success: true,
        documentsCreated: 0,
        documents: [],
        reason: existingAttachmentIds.size > 0 
          ? `All ${unattachedAttachments.length} attachments were already imported`
          : 'No attachments to import'
      })
    }
    
    // Fetch corresponding messages
    const messageIds = [...new Set(toImport.map(a => a.gmail_message_id))]
    const { data: messages, error: messagesError } = await supabase
      .from('gmail_messages')
      .select('*')
      .eq('user_email', trimmedEmail)
      .in('gmail_message_id', messageIds)
    
    if (messagesError) {
      return NextResponse.json(
        { error: 'Failed to fetch messages', details: messagesError.message },
        { status: 500 }
      )
    }
    
    const messageMap = new Map(
      (messages || []).map(m => [m.gmail_message_id, m as GmailMessageRow])
    )
    
    // Import each attachment
    const createdDocuments = []
    const errors = []
    
    console.log(`📦 Starting import of ${toImport.length} attachments`)
    
    for (const attachment of toImport) {
      const message = messageMap.get(attachment.gmail_message_id)
      if (!message) {
        const errorMsg = `Message not found for attachment ${attachment.gmail_attachment_id}`
        console.warn(`⚠️ ${errorMsg}`)
        errors.push({
          attachmentId: attachment.gmail_attachment_id,
          fileName: attachment.file_name || 'unknown',
          error: errorMsg
        })
        continue
      }
      
      try {
        const result = await importAttachmentAsDocument(
          trimmedEmail,
          attachment as GmailAttachmentRow,
          message
        )
        
        if (result.document) {
          createdDocuments.push(result.document)
          console.log(`✅ Imported: ${attachment.file_name || 'unknown'}`)
        } else {
          const errorMsg = result.error || 'Unknown error'
          console.error(`❌ Failed to import ${attachment.file_name || 'unknown'}: ${errorMsg}`)
          errors.push({
            attachmentId: attachment.gmail_attachment_id,
            fileName: attachment.file_name || 'unknown',
            error: errorMsg
          })
        }
      } catch (err: any) {
        const errorMsg = err.message || 'Unexpected error during import'
        console.error(`❌ Exception importing ${attachment.file_name || 'unknown'}: ${errorMsg}`)
        errors.push({
          attachmentId: attachment.gmail_attachment_id,
          fileName: attachment.file_name || 'unknown',
          error: errorMsg
        })
      }
    }
    
    console.log(`📊 Import complete: ${createdDocuments.length} succeeded, ${errors.length} failed`)
    
    return NextResponse.json({
      success: true,
      documentsCreated: createdDocuments.length,
      documents: createdDocuments,
      errors: errors.length > 0 ? errors : undefined,
      totalProcessed: toImport.length
    })
  } catch (error: any) {
    console.error('Error importing attachments to documents:', error)
    return NextResponse.json(
      { error: 'Failed to import attachments', details: error.message },
      { status: 500 }
    )
  }
}

