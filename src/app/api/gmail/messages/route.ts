import { NextRequest, NextResponse } from 'next/server'
import { getAuthorizedGmailClient } from '../../../../lib/gmail'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userEmail = searchParams.get('userEmail')
    const contactEmail = searchParams.get('contactEmail')
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam, 10) : 20

    if (!userEmail) {
      return NextResponse.json(
        { error: 'Missing userEmail parameter' },
        { status: 400 }
      )
    }

    if (!contactEmail) {
      return NextResponse.json(
        { error: 'Missing contactEmail parameter' },
        { status: 400 }
      )
    }

    const gmail = await getAuthorizedGmailClient(userEmail)

    // Search for messages from or to the contact
    const query = `from:${contactEmail} OR to:${contactEmail}`
    
    const listResponse = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: limit,
    })

    const messages = listResponse.data.messages || []

    // Fetch full details for each message
    const messageDetails = await Promise.all(
      messages.map(async (msg) => {
        const messageResponse = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id!,
          format: 'metadata',
          metadataHeaders: ['Subject', 'From', 'To', 'Date'],
        })

        const headers = messageResponse.data.payload?.headers || []
        const subject = headers.find((h) => h.name === 'Subject')?.value || '(No subject)'
        const from = headers.find((h) => h.name === 'From')?.value || ''
        const to = headers.find((h) => h.name === 'To')?.value || ''
        const date = headers.find((h) => h.name === 'Date')?.value || ''
        const snippet = messageResponse.data.snippet || ''

        return {
          id: msg.id!,
          threadId: msg.threadId!,
          subject,
          from,
          to,
          date,
          snippet,
        }
      })
    )

    return NextResponse.json({ messages: messageDetails })
  } catch (error: any) {
    console.error('Error fetching Gmail messages:', error)
    
    // Provide more helpful error messages
    if (error.message?.includes('not connected')) {
      return NextResponse.json(
        { error: 'Gmail not connected. Please connect your Gmail account first.' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to fetch Gmail messages', details: error.message },
      { status: 500 }
    )
  }
}

