import { NextRequest, NextResponse } from 'next/server'
import { fetchMessagesWithAttachments } from '@/lib/gmail-sync'
import { supabase } from '@/lib/supabase'
import { isGmailConnected } from '@/lib/gmail'

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
    
    // Check if Gmail is connected
    const connected = await isGmailConnected(trimmedEmail)
    if (!connected) {
      return NextResponse.json(
        { error: 'Gmail not connected. Please connect your Gmail account first.' },
        { status: 401 }
      )
    }
    
    // Fetch messages with attachments from Gmail
    // Query: all attachments (not just PDF/XML/HTML)
    const { messages, attachments } = await fetchMessagesWithAttachments(trimmedEmail, {
      query: 'has:attachment',
      maxResults: 100
    })
    
    // Upsert messages into database (idempotent)
    let messagesProcessed = 0
    for (const message of messages) {
      const { error } = await supabase
        .from('gmail_messages')
        .upsert({
          user_email: message.user_email,
          gmail_message_id: message.gmail_message_id,
          thread_id: message.thread_id,
          from_email: message.from_email,
          from_name: message.from_name,
          to_email: message.to_email,
          to_name: message.to_name,
          subject: message.subject,
          snippet: message.snippet,
          internal_date: message.internal_date,
          has_attachments: message.has_attachments,
          raw_header: message.raw_header,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_email,gmail_message_id'
        })
      
      if (!error) {
        messagesProcessed++
      } else {
        // Check if table doesn't exist
        if (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('relation') || error.message?.includes('gmail_messages')) {
          throw new Error('gmail_messages table does not exist. Please run migration-add-gmail-sync-tables.sql in Supabase SQL Editor.')
        }
        console.error('Error upserting message:', error)
        throw new Error(`Failed to save message: ${error.message || JSON.stringify(error)}`)
      }
    }
    
    // Upsert attachments into database (idempotent)
    let attachmentsRecorded = 0
    for (const attachment of attachments) {
      const { error } = await supabase
        .from('gmail_attachments')
        .upsert({
          user_email: attachment.user_email,
          gmail_message_id: attachment.gmail_message_id,
          gmail_attachment_id: attachment.gmail_attachment_id,
          file_name: attachment.file_name,
          mime_type: attachment.mime_type,
          size_bytes: attachment.size_bytes,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_email,gmail_attachment_id'
        })
      
      if (!error) {
        attachmentsRecorded++
      } else {
        // Check if table doesn't exist
        if (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('relation') || error.message?.includes('gmail_attachments')) {
          throw new Error('gmail_attachments table does not exist. Please run migration-add-gmail-sync-tables.sql in Supabase SQL Editor.')
        }
        console.error('Error upserting attachment:', error)
        throw new Error(`Failed to save attachment: ${error.message || JSON.stringify(error)}`)
      }
    }
    
    return NextResponse.json({
      success: true,
      messagesProcessed,
      attachmentsRecorded
    })
  } catch (error: any) {
    console.error('Error syncing Gmail attachments:', error)
    const errorMessage = error.message || 'Unknown error'
    const errorDetails = error.stack || JSON.stringify(error, null, 2)
    console.error('Error details:', errorDetails)
    return NextResponse.json(
      { 
        error: 'Failed to sync Gmail attachments', 
        details: errorMessage,
        fullError: process.env.NODE_ENV === 'development' ? errorDetails : undefined
      },
      { status: 500 }
    )
  }
}

