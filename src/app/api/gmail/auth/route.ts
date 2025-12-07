import { NextRequest, NextResponse } from 'next/server'
import { getAuthUrl } from '../../../../lib/gmail'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userEmail = searchParams.get('userEmail')

    if (!userEmail) {
      return NextResponse.json(
        { error: 'Missing userEmail parameter' },
        { status: 400 }
      )
    }

    const authUrl = getAuthUrl(userEmail)

    return NextResponse.redirect(authUrl)
  } catch (error: any) {
    console.error('Error generating Gmail auth URL:', error)
    return NextResponse.json(
      { error: 'Failed to generate auth URL', details: error.message },
      { status: 500 }
    )
  }
}

