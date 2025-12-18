import { NextRequest, NextResponse } from 'next/server'
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
    
    // Delete tokens from gmail_credentials table
    const { error } = await supabase
      .from('gmail_credentials')
      .delete()
      .eq('user_email', trimmedEmail)
    
    if (error) {
      console.error('Error disconnecting Gmail:', error)
      return NextResponse.json(
        { error: 'Failed to disconnect Gmail', details: error.message },
        { status: 500 }
      )
    }
    
    console.log('✅ Gmail disconnected for:', trimmedEmail)
    
    return NextResponse.json({ 
      success: true,
      message: 'Gmail disconnected successfully'
    })
  } catch (error: any) {
    console.error('Error in disconnect endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

