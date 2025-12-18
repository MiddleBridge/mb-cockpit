import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAccessToken } from '@/lib/gmail';

export async function GET(request: NextRequest) {
  try {
    const messageId = request.nextUrl.searchParams.get('messageId');
    const attachmentId = request.nextUrl.searchParams.get('attachmentId');
    const userEmail = request.nextUrl.searchParams.get('userEmail');
    const preview = request.nextUrl.searchParams.get('preview') === 'true';

    if (!messageId || !attachmentId || !userEmail) {
      return NextResponse.json(
        { error: 'Missing messageId, attachmentId, or userEmail' },
        { status: 400 }
      );
    }

    // Get access token
    const accessToken = await getAccessToken(userEmail.trim());
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Gmail not connected' },
        { status: 401 }
      );
    }

    // Create Gmail client
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: 'v1', auth });

    // Download attachment
    const attachmentResponse = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId: messageId,
      id: attachmentId,
    });

    if (!attachmentResponse.data.data) {
      return NextResponse.json(
        { error: 'Attachment not found' },
        { status: 404 }
      );
    }

    // Decode base64 attachment data (Gmail uses base64url encoding)
    let attachmentData = attachmentResponse.data.data;
    // Replace URL-safe base64 characters with standard base64
    attachmentData = attachmentData.replace(/-/g, '+').replace(/_/g, '/');
    // Add padding if needed
    while (attachmentData.length % 4) {
      attachmentData += '=';
    }
    
    const buffer = Buffer.from(attachmentData, 'base64');

    // Get attachment info from message
    const messageResponse = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    let filename = 'attachment';
    let mimeType = 'application/octet-stream';

    // Find attachment in message parts
    const findAttachment = (parts: any[]): any => {
      for (const part of parts) {
        if (part.body?.attachmentId === attachmentId) {
          return part;
        }
        if (part.parts) {
          const found = findAttachment(part.parts);
          if (found) return found;
        }
      }
      return null;
    };

    if (messageResponse.data.payload?.parts) {
      const attachmentPart = findAttachment(messageResponse.data.payload.parts);
      if (attachmentPart) {
        filename = attachmentPart.filename || filename;
        mimeType = attachmentPart.mimeType || mimeType;
      }
    }

    // Set Content-Disposition based on preview mode
    const contentDisposition = preview 
      ? `inline; filename="${encodeURIComponent(filename)}"`
      : `attachment; filename="${encodeURIComponent(filename)}"`;

    // Return file with proper headers
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': contentDisposition,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error: any) {
    console.error('Error downloading attachment:', error);
    return NextResponse.json(
      { error: 'Failed to download attachment', details: error.message },
      { status: 500 }
    );
  }
}

