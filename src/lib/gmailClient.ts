import { google } from 'googleapis';
import { ContactFile } from '@/types/email';

/**
 * Fetches PDF/DOC attachments from Gmail messages sent to or received from a contact
 * @param accessToken - Google OAuth access token
 * @param contactEmail - Email address of the contact
 * @returns Array of ContactFile metadata
 */
export async function fetchFilesByContact(
  accessToken: string,
  contactEmail: string
): Promise<ContactFile[]> {
  try {
    // Create OAuth2 client with access token
    const auth = new google.auth.OAuth2();
    auth.setCredentials({
      access_token: accessToken,
    });

    // Create Gmail client
    const gmail = google.gmail({ version: 'v1', auth });

    // Search for messages with attachments from/to the contact
    const query = `(from:${contactEmail} OR to:${contactEmail} OR cc:${contactEmail} OR bcc:${contactEmail}) has:attachment`;
    
    // Fetch messages with pagination to get all messages
    let allMessages: any[] = [];
    let pageToken: string | undefined = undefined;
    const maxResultsPerPage = 100;
    const maxPages = 10; // Limit to 10 pages (1000 messages max) to avoid timeout

    do {
      const messagesResponse = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: maxResultsPerPage,
        pageToken: pageToken,
      });

      if (messagesResponse.data.messages) {
        allMessages = allMessages.concat(messagesResponse.data.messages);
      }

      pageToken = messagesResponse.data.nextPageToken || undefined;
    } while (pageToken && allMessages.length < maxPages * maxResultsPerPage);

    console.log(`📧 Found ${allMessages.length} messages with attachments for ${contactEmail}`);

    if (allMessages.length === 0) {
      console.log(`📭 No messages with attachments found for ${contactEmail}`);
      return [];
    }

    const files: ContactFile[] = [];

    // Process each message
    for (const messageRef of allMessages) {
      if (!messageRef.id) continue;

      try {
        // Get full message details
        const messageResponse = await gmail.users.messages.get({
          userId: 'me',
          id: messageRef.id,
          format: 'full',
        });

        const message = messageResponse.data;
        if (!message.payload) continue;

        // Extract headers
        const headers = message.payload.headers || [];
        const getHeader = (name: string): string => {
          const header = headers.find((h) => h.name?.toLowerCase() === name.toLowerCase());
          return header?.value || '';
        };

        const subject = getHeader('Subject');
        const from = getHeader('From');
        const to = getHeader('To');
        const date = getHeader('Date');

        // Determine direction
        const direction: 'sent' | 'received' = from.toLowerCase().includes(contactEmail.toLowerCase())
          ? 'received'
          : 'sent';

        // Parse To addresses
        const emailTo = to
          .split(',')
          .map((addr) => addr.trim())
          .filter((addr) => addr.length > 0);

        // Recursively extract attachments from message parts
        const extractAttachments = (parts: any[], partIdPrefix: string = ''): void => {
          for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const currentPartId = partIdPrefix ? `${partIdPrefix}.${i + 1}` : `${i + 1}`;

            // Check if this part has an attachment
            if (part.filename && part.filename.trim() !== '' && part.body?.attachmentId) {
              const mimeType = part.mimeType || '';
              const filename = part.filename.toLowerCase();

              // Exclude .png, .jpg, .jpeg, .ics, .p7s files, digital signatures, and emoji
              if (filename.endsWith('.png') || 
                  filename.endsWith('.jpg') || 
                  filename.endsWith('.jpeg') ||
                  filename.endsWith('.ics') ||
                  filename.endsWith('.p7s') ||
                  filename.includes('smime') ||
                  filename.includes('emoji') ||
                  mimeType.includes('pkcs7') ||
                  mimeType.includes('signature') ||
                  // Check for emoji in filename (common emoji characters)
                  /[\u{1F300}-\u{1F9FF}]/u.test(part.filename) ||
                  /[\u{2600}-\u{26FF}]/u.test(part.filename) ||
                  /[\u{2700}-\u{27BF}]/u.test(part.filename)) {
                return; // Skip this attachment
              }

              // Check if it's a document or image file
              const isPdf = mimeType === 'application/pdf';
              const isDoc = mimeType === 'application/msword' ||
                           mimeType.startsWith('application/vnd.openxmlformats-officedocument');
              const isExcel = mimeType === 'application/vnd.ms-excel' ||
                             mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
              const isPowerPoint = mimeType === 'application/vnd.ms-powerpoint' ||
                                  mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
              const isImage = mimeType.startsWith('image/');
              const isArchive = mimeType === 'application/zip' ||
                               mimeType === 'application/x-rar-compressed' ||
                               mimeType === 'application/x-7z-compressed';
              const isText = mimeType.startsWith('text/');

              // Include all document types, images (except excluded), archives, and text files
              if (isPdf || isDoc || isExcel || isPowerPoint || isImage || isArchive || isText) {
                files.push({
                  id: `${messageRef.id}-${currentPartId}`,
                  emailMessageId: messageRef.id,
                  attachmentId: part.body.attachmentId || '',
                  partId: currentPartId,
                  fileName: part.filename,
                  mimeType: mimeType,
                  size: part.body.size || 0,
                  direction: direction,
                  emailSubject: subject,
                  emailDate: date,
                  emailFrom: from,
                  emailTo: emailTo,
                });
              }
            }

            // Recursively process nested parts
            if (part.parts && Array.isArray(part.parts)) {
              extractAttachments(part.parts, currentPartId);
            }
          }
        };

        // Start extraction from root payload
        if (message.payload.parts && Array.isArray(message.payload.parts)) {
          extractAttachments(message.payload.parts);
        } else if (message.payload.body?.attachmentId) {
          // Single attachment in root payload
          const filename = getHeader('Content-Disposition')?.match(/filename="?([^"]+)"?/)?.[1] || '';
          const mimeType = message.payload.mimeType || '';
          
          // Check if it's a document or image file (same logic as above)
          const isPdf = mimeType === 'application/pdf';
          const isDoc = mimeType === 'application/msword' ||
                       mimeType.startsWith('application/vnd.openxmlformats-officedocument');
          const isExcel = mimeType === 'application/vnd.ms-excel' ||
                         mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          const isPowerPoint = mimeType === 'application/vnd.ms-powerpoint' ||
                              mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
          const isImage = mimeType.startsWith('image/');
          const isArchive = mimeType === 'application/zip' ||
                           mimeType === 'application/x-rar-compressed' ||
                           mimeType === 'application/x-7z-compressed';
          const isText = mimeType.startsWith('text/');
          
          if (filename && (isPdf || isDoc || isExcel || isPowerPoint || isImage || isArchive || isText)) {
            files.push({
              id: `${messageRef.id}-root`,
              emailMessageId: messageRef.id,
              attachmentId: message.payload.body.attachmentId || '',
              partId: 'root',
              fileName: filename,
              mimeType: mimeType,
              size: message.payload.body.size || 0,
              direction: direction,
              emailSubject: subject,
              emailDate: date,
              emailFrom: from,
              emailTo: emailTo,
            });
          }
        }
      } catch (error: any) {
        // Log error but continue processing other messages
        console.error(`Error processing message ${messageRef.id}:`, error.message || 'Unknown error');
      }
    }

    return files;
  } catch (error: any) {
    // Handle Gmail API errors
    if (error.code === 401 || error.message?.includes('invalid_grant') || error.message?.includes('Invalid Credentials')) {
      throw new Error('Gmail authentication failed');
    }
    
    // Log error without exposing secrets
    console.error('Error fetching files from Gmail:', error.message || 'Unknown error');
    throw new Error(`Failed to fetch files: ${error.message || 'Unknown error'}`);
  }
}

