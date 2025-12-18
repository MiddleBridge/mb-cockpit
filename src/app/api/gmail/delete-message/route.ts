import { NextRequest, NextResponse } from 'next/server'
import { getAuthorizedGmailClient } from '../../../../lib/gmail'

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userEmail = searchParams.get('userEmail')
    const messageId = searchParams.get('messageId')

    if (!userEmail) {
      return NextResponse.json(
        { error: 'Missing userEmail parameter' },
        { status: 400 }
      )
    }

    if (!messageId) {
      return NextResponse.json(
        { error: 'Missing messageId parameter' },
        { status: 400 }
      )
    }

    const gmail = await getAuthorizedGmailClient(userEmail)

    // Delete the message (moves to trash)
    await gmail.users.messages.delete({
      userId: 'me',
      id: messageId,
    })

    return NextResponse.json({ 
      success: true,
      message: 'Email deleted successfully'
    })
  } catch (error: any) {
    console.error('Error deleting Gmail message:', error)
    
    if (error.message?.includes('not connected')) {
      return NextResponse.json(
        { error: 'Gmail not connected. Please connect your Gmail account first.' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to delete email', details: error.message },
      { status: 500 }
    )
  }
}

