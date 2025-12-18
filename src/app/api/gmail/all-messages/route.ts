import { NextRequest, NextResponse } from 'next/server'
import { getAuthorizedGmailClient } from '../../../../lib/gmail'
import { supabase } from '../../../../lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userEmail = searchParams.get('userEmail')
    const limitParam = searchParams.get('limit')
    const pageToken = searchParams.get('pageToken')
    const query = searchParams.get('query') || 'in:inbox' // Default to inbox
    const limit = limitParam ? parseInt(limitParam, 10) : 50

    if (!userEmail) {
      return NextResponse.json(
        { error: 'Missing userEmail parameter' },
        { status: 400 }
      )
    }

    const gmail = await getAuthorizedGmailClient(userEmail)

    // List messages from Gmail
    const listResponse = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: limit,
      pageToken: pageToken || undefined,
    })

    const messages = listResponse.data.messages || []
    const nextPageToken = listResponse.data.nextPageToken

    // Fetch full details for each message
    const messageDetails = await Promise.all(
      messages.map(async (msg) => {
        try {
          const messageResponse = await gmail.users.messages.get({
            userId: 'me',
            id: msg.id!,
            format: 'full', // Use 'full' to get attachment details
          })

          const headers = messageResponse.data.payload?.headers || []
          const subject = headers.find((h) => h.name === 'Subject')?.value || '(No subject)'
          const from = headers.find((h) => h.name === 'From')?.value || ''
          const to = headers.find((h) => h.name === 'To')?.value || ''
          const cc = headers.find((h) => h.name === 'Cc')?.value || ''
          const bcc = headers.find((h) => h.name === 'Bcc')?.value || ''
          const date = headers.find((h) => h.name === 'Date')?.value || ''
          const snippet = messageResponse.data.snippet || ''
          
          // Extract attachments with details (same logic as in gmailClient.ts)
          const extractAttachments = (parts: any[]): any[] => {
            const attachments: any[] = []
            for (const part of parts) {
              if (part.filename && part.filename.trim() !== '' && part.body?.attachmentId) {
                const mimeType = part.mimeType || 'application/octet-stream'
                const filename = part.filename.toLowerCase()
                
                // Skip digital signatures and emoji files
                if (mimeType.includes('pkcs7') || 
                    mimeType.includes('signature') ||
                    filename.endsWith('.p7s') ||
                    filename.includes('smime') ||
                    filename.includes('emoji') ||
                    /[\u{1F300}-\u{1F9FF}]/u.test(part.filename) ||
                    /[\u{2600}-\u{26FF}]/u.test(part.filename) ||
                    /[\u{2700}-\u{27BF}]/u.test(part.filename)) {
                  continue // Skip this attachment
                }
                
                attachments.push({
                  id: part.body.attachmentId,
                  filename: part.filename,
                  mimeType: mimeType,
                  size: part.body.size ? parseInt(part.body.size.toString()) : null,
                })
              }
              // Recursively check nested parts
              if (part.parts && Array.isArray(part.parts)) {
                attachments.push(...extractAttachments(part.parts))
              }
            }
            return attachments
          }
          
          // Helper function to check if file extension should be excluded
          const shouldExcludeAttachment = (filename: string): boolean => {
            const lowerFilename = filename.toLowerCase()
            return lowerFilename.endsWith('.png') || 
                   lowerFilename.endsWith('.jpg') || 
                   lowerFilename.endsWith('.jpeg') ||
                   lowerFilename.endsWith('.ics') ||
                   lowerFilename.endsWith('.p7s') ||
                   lowerFilename.includes('smime') ||
                   lowerFilename.includes('emoji') ||
                   // Check for emoji in filename (common emoji characters)
                   /[\u{1F300}-\u{1F9FF}]/u.test(filename) ||
                   /[\u{2600}-\u{26FF}]/u.test(filename) ||
                   /[\u{2700}-\u{27BF}]/u.test(filename)
          }
          
          // Check for attachments in payload parts
          let attachments: any[] = []
          if (messageResponse.data.payload?.parts && Array.isArray(messageResponse.data.payload.parts)) {
            attachments = extractAttachments(messageResponse.data.payload.parts)
          } else if (messageResponse.data.payload?.body?.attachmentId) {
            // Single attachment in root payload (rare case)
            const filename = headers.find((h) => h.name === 'Content-Disposition')?.value?.match(/filename="?([^"]+)"?/)?.[1] || 'attachment'
            attachments.push({
              id: messageResponse.data.payload.body.attachmentId,
              filename: filename,
              mimeType: messageResponse.data.payload.mimeType || 'application/octet-stream',
              size: messageResponse.data.payload.body.size ? parseInt(messageResponse.data.payload.body.size.toString()) : null,
            })
          }
          
          // Filter out excluded file types (.png, .jpg, .ics)
          attachments = attachments.filter(att => !shouldExcludeAttachment(att.filename))
          
          const hasAttachments = attachments.length > 0
          const attachmentCount = attachments.length

          // Check if message is read
          const labelIds = messageResponse.data.labelIds || []
          const isRead = !labelIds.includes('UNREAD')

          return {
            id: msg.id!,
            threadId: msg.threadId!,
            subject,
            from,
            to,
            cc,
            bcc,
            date,
            snippet,
            hasAttachments,
            attachmentCount,
            attachments, // Full attachment details
            isRead,
            labelIds,
          }
        } catch (error) {
          console.error(`Error fetching message ${msg.id}:`, error)
          return null
        }
      })
    )

    // Filter out null results (failed fetches)
    const validMessages = messageDetails.filter(msg => msg !== null)

    // Check which messages have documents imported
    const messageIds = validMessages.map(msg => msg.id)
    const { data: documents } = await supabase
      .from('documents')
      .select('source_gmail_message_id')
      .in('source_gmail_message_id', messageIds)
      .not('source_gmail_message_id', 'is', null)

    const messagesWithDocuments = new Set(
      (documents || []).map(d => d.source_gmail_message_id).filter(Boolean)
    )

    // Add hasDocuments flag to each message
    const messagesWithDocInfo = validMessages.map(msg => ({
      ...msg,
      hasDocuments: messagesWithDocuments.has(msg.id)
    }))

    return NextResponse.json({ 
      messages: messagesWithDocInfo,
      nextPageToken: nextPageToken || null,
      resultSizeEstimate: listResponse.data.resultSizeEstimate || 0
    })
  } catch (error: any) {
    console.error('❌ Error fetching Gmail messages:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
      name: error.name,
      fullError: error,
    })
    
    // Provide more helpful error messages
    if (error.message?.includes('not connected') || error.code === '401') {
      return NextResponse.json(
        { error: 'Gmail not connected. Please connect your Gmail account first.' },
        { status: 401 }
      )
    }
    
    if (error.message?.includes('token') || error.message?.includes('expired')) {
      return NextResponse.json(
        { error: 'Gmail token expired. Please reconnect your Gmail account.' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { 
        error: 'Failed to fetch Gmail messages', 
        details: error.message || 'Unknown error',
        code: error.code,
      },
      { status: 500 }
    )
  }
}

