import { NextRequest, NextResponse } from 'next/server';
import { fetchFilesByContact } from '@/lib/gmailClient';
import { getAccessToken } from '@/lib/gmail';
import { ContactFile } from '@/types/email';

export async function GET(request: NextRequest) {
  try {
    // Get email from query params (contact email)
    const email = request.nextUrl.searchParams.get('email');
    
    if (!email || email.trim() === '') {
      return NextResponse.json(
        { error: 'Missing email parameter' },
        { status: 400 }
      );
    }

    // Get userEmail from query params (the logged-in user's email)
    const userEmail = request.nextUrl.searchParams.get('userEmail');
    
    if (!userEmail || userEmail.trim() === '') {
      return NextResponse.json(
        { error: 'Missing userEmail parameter. Please connect your Gmail account first.' },
        { status: 401 }
      );
    }

    // Get access token from database
    console.log('🔍 files-by-contact: Getting access token for:', userEmail.trim());
    const accessToken = await getAccessToken(userEmail.trim());
    console.log('🔍 files-by-contact: Access token result:', { hasToken: !!accessToken, tokenLength: accessToken?.length || 0 });
    
    if (!accessToken) {
      console.warn('⚠️ files-by-contact: No access token found');
      return NextResponse.json(
        { error: 'Gmail not connected. Please connect your Gmail account first.' },
        { status: 401 }
      );
    }

    // Fetch files from Gmail
    try {
      const files: ContactFile[] = await fetchFilesByContact(accessToken, email.trim());
      
      return NextResponse.json({ files });
    } catch (error: any) {
      // Handle Gmail authentication errors
      if (
        error.message?.includes('Gmail authentication failed') ||
        error.message?.includes('invalid_grant') ||
        error.message?.includes('Invalid Credentials') ||
        error.message?.includes('401')
      ) {
        return NextResponse.json(
          { error: 'Gmail authentication failed. Please reconnect your Gmail account.' },
          { status: 401 }
        );
      }

      // Re-throw other errors to be caught by outer catch
      throw error;
    }
  } catch (error: any) {
    // Log error without exposing secrets
    console.error('Error in files-by-contact endpoint:', error.message || 'Unknown error');
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

