import { google } from 'googleapis'
import { getAccessToken } from './gmail'
import { supabase } from './supabase'
import { getContacts } from './db/contacts'
import { getOrganisations, createOrganisation } from './db/organisations'
import { createDocument } from './db/documents'

// Types for Gmail data
export interface GmailMessageRow {
  id?: string
  user_email: string
  gmail_message_id: string
  thread_id: string
  from_email?: string | null
  from_name?: string | null
  to_email?: string | null
  to_name?: string | null
  subject?: string | null
  snippet?: string | null
  internal_date?: string | null
  has_attachments: boolean
  raw_header?: any
}

export interface GmailAttachmentRow {
  id?: string
  user_email: string
  gmail_message_id: string
  gmail_attachment_id: string
  file_name?: string | null
  mime_type?: string | null
  size_bytes?: number | null
  supabase_file_path?: string | null
}

export interface EmailContext {
  from_email?: string | null
  from_name?: string | null
  to_email?: string | null
  to_name?: string | null
  subject?: string | null
  snippet?: string | null
}

/**
 * Parse email address from Gmail header format
 * Example: "John Doe <john@example.com>" -> { name: "John Doe", email: "john@example.com" }
 */
function parseEmailAddress(headerValue?: string | null): { name?: string; email?: string } {
  if (!headerValue) return {}
  
  const match = headerValue.match(/^(.*?)\s*<(.+?)>$|^(.+?)$/)
  if (match) {
    if (match[3]) {
      // Just email, no name
      return { email: match[3].trim() }
    } else {
      // Name and email
      return {
        name: match[1]?.trim() || undefined,
        email: match[2]?.trim() || undefined
      }
    }
  }
  return {}
}

/**
 * Extract domain from email address
 */
function extractDomain(email?: string | null): string | null {
  if (!email) return null
  const match = email.match(/@(.+)$/)
  return match ? match[1].toLowerCase() : null
}

/**
 * Extract organisation name from email context using heuristics
 */
function extractOrganisationName(ctx: EmailContext): string | null {
  // Try from subject first
  if (ctx.subject) {
    // Look for common patterns
    const patterns = [
      /(?:^|\s)([A-Z][A-Za-z0-9\s&\.]+(?:Sp\.?\s*z\s*o\.?\s*o\.?|S\.?\s*A\.?|LLC|GmbH|Ltd\.?|Inc\.?|Corp\.?))/i,
      /(?:^|\s)([A-Z][A-Za-z0-9\s&\.]{3,})/,
    ]
    
    for (const pattern of patterns) {
      const match = ctx.subject.match(pattern)
      if (match && match[1]) {
        const name = match[1].trim()
        // Filter out common non-organisation words
        if (name.length > 3 && !/^(Invoice|Faktura|Rechnung|Bill)/i.test(name)) {
          return name
        }
      }
    }
  }
  
  // Try from from_name
  if (ctx.from_name) {
    // If it looks like an organisation name (has common suffixes)
    if (/Sp\.?\s*z\s*o\.?\s*o\.?|S\.?\s*A\.?|LLC|GmbH|Ltd\.?|Inc\.?|Corp\.?/i.test(ctx.from_name)) {
      return ctx.from_name
    }
  }
  
  // Try from snippet
  if (ctx.snippet) {
    const match = ctx.snippet.match(/([A-Z][A-Za-z0-9\s&\.]+(?:Sp\.?\s*z\s*o\.?\s*o\.?|S\.?\s*A\.?|LLC|GmbH|Ltd\.?|Inc\.?|Corp\.?))/i)
    if (match && match[1]) {
      return match[1].trim()
    }
  }
  
  return null
}

/**
 * Extract organisation name from filename
 * Examples: "MiddleBridge_Rigby_Invoice.pdf" -> "Rigby"
 *           "2025-08-MiddleBridge_Rigby_Invoice.pdf" -> "Rigby"
 */
function extractOrganisationFromFilename(fileName: string): string | null {
  if (!fileName) return null
  
  // Remove file extension
  const nameWithoutExt = fileName.replace(/\.[^.]+$/, '')
  
  // Try patterns like: "MiddleBridge_Rigby_Invoice" or "2025-08-MiddleBridge_Rigby_Invoice"
  // Look for organization names after "MiddleBridge" or similar prefixes
  const patterns = [
    /(?:MiddleBridge[_-])([A-Z][A-Za-z0-9]+)/i,
    /(?:^|\d{4}[_-]\d{2}[_-]?)([A-Z][A-Za-z0-9]+)(?:[_-](?:Invoice|Faktura|Invoice))/i,
    /([A-Z][A-Za-z0-9\s&\.]+(?:Sp\.?\s*z\s*o\.?\s*o\.?|S\.?\s*A\.?|LLC|GmbH|Ltd\.?|Inc\.?|Corp\.?))/i,
  ]
  
  for (const pattern of patterns) {
    const match = nameWithoutExt.match(pattern)
    if (match && match[1]) {
      const orgName = match[1].trim()
      // Filter out common words
      if (orgName.length > 2 && !/^(Invoice|Faktura|Rechnung|Bill|MiddleBridge|Middle|Bridge)/i.test(orgName)) {
        return orgName
      }
    }
  }
  
  return null
}

/**
 * Detect document type from filename or subject
 * Returns 'Invoice' if invoice/faktura is found, null otherwise
 */
function detectDocumentType(fileName: string, subject?: string | null): 'Invoice' | null {
  const text = `${fileName} ${subject || ''}`.toLowerCase()
  
  // Check for invoice keywords
  if (/invoice|faktura|rechnung|bill|rachunek/i.test(text)) {
    return 'Invoice'
  }
  
  return null
}

/**
 * Infer contact and organisation from email context
 */
export async function inferContactAndOrganisation(
  ctx: EmailContext
): Promise<{
  contact_email?: string | null
  contact_name?: string | null
  contact_id?: string | null
  organisation_id?: string | null
  organisation_name_guess?: string | null
}> {
  // Default: use from_email/from_name as contact
  const contact_email = ctx.from_email || null
  const contact_name = ctx.from_name || null
  
  // Try to find existing contact by email
  let contact_id: string | null = null
  if (contact_email) {
    try {
      const contacts = await getContacts()
      const matchingContact = contacts.find(c => c.email?.toLowerCase() === contact_email.toLowerCase())
      if (matchingContact) {
        contact_id = matchingContact.id
      }
    } catch (error) {
      console.error('Error fetching contacts:', error)
    }
  }
  
  // Try to match organisation by domain
  let organisation_id: string | null = null
  const domain = extractDomain(contact_email)
  
  if (domain) {
    try {
      const organisations = await getOrganisations()
      // Try to match by website domain (if organisations have website field)
      // For now, we'll use a simple heuristic: check if organisation name contains domain
      // This is a basic implementation - can be improved with actual website matching
      const matchingOrg = organisations.find(org => {
        if (org.website) {
          const orgDomain = extractDomain(org.website.replace(/^https?:\/\//, ''))
          return orgDomain === domain
        }
        return false
      })
      
      if (matchingOrg) {
        organisation_id = matchingOrg.id
      }
    } catch (error) {
      console.error('Error fetching organisations:', error)
    }
  }
  
  // If no organisation matched, try to extract name from context
  let organisation_name_guess: string | null = null
  if (!organisation_id) {
    organisation_name_guess = extractOrganisationName(ctx)
    
    // If we have a guess but no ID, try to create the organisation
    if (organisation_name_guess) {
      try {
        const organisations = await getOrganisations()
        const existingOrg = organisations.find(org => 
          org.name.toLowerCase() === organisation_name_guess!.toLowerCase()
        )
        
        if (!existingOrg) {
          // Create organisation if it doesn't exist
          const newOrg = await createOrganisation({
            name: organisation_name_guess,
            categories: [],
            priority: 'mid',
            status: 'ongoing'
          })
          if (newOrg) {
            organisation_id = newOrg.id
            console.log(`✅ Created new organisation "${organisation_name_guess}" from email context`)
          }
        } else {
          organisation_id = existingOrg.id
        }
      } catch (error) {
        console.error('Error creating organisation:', error)
      }
    }
  }
  
  return {
    contact_email,
    contact_name,
    contact_id: contact_id || null,
    organisation_id: organisation_id || null,
    organisation_name_guess
  }
}

/**
 * Fetch messages with attachments from Gmail
 */
export async function fetchMessagesWithAttachments(
  userEmail: string,
  options?: { query?: string; maxResults?: number; pageToken?: string }
): Promise<{ messages: GmailMessageRow[]; attachments: GmailAttachmentRow[] }> {
  // Get access token (doesn't require client secret)
  const accessToken = await getAccessToken(userEmail)
  if (!accessToken) {
    throw new Error('Gmail not connected. Please connect your Gmail account first.')
  }
  
  // Create Gmail client with access token
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  const gmail = google.gmail({ version: 'v1', auth })
  
  const query = options?.query || 'has:attachment'
  const maxResults = options?.maxResults || 50
  
  // List messages
  const listResponse = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults,
    pageToken: options?.pageToken
  })
  
  const messages: GmailMessageRow[] = []
  const attachments: GmailAttachmentRow[] = []
  
  const messageList = listResponse.data.messages || []
  
  // Fetch full details for each message
  for (const msg of messageList) {
    if (!msg.id) continue
    
    try {
      const messageResponse = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'metadata',
        metadataHeaders: ['From', 'To', 'Subject', 'Date']
      })
      
      const message = messageResponse.data
      const headers = message.payload?.headers || []
      
      // Extract headers
      const fromHeader = headers.find(h => h.name === 'From')?.value
      const toHeader = headers.find(h => h.name === 'To')?.value
      const subjectHeader = headers.find(h => h.name === 'Subject')?.value
      const dateHeader = headers.find(h => h.name === 'Date')?.value
      
      const fromParsed = parseEmailAddress(fromHeader)
      const toParsed = parseEmailAddress(toHeader)
      
      // Parse internal date
      let internalDate: string | null = null
      if (message.internalDate) {
        internalDate = new Date(parseInt(message.internalDate)).toISOString()
      } else if (dateHeader) {
        try {
          internalDate = new Date(dateHeader).toISOString()
        } catch (e) {
          // Ignore date parsing errors
        }
      }
      
      // Check for attachments
      const parts = message.payload?.parts || []
      const hasAttachments = parts.some(part => part.filename && part.body?.attachmentId)
      
      const gmailMessage: GmailMessageRow = {
        user_email: userEmail,
        gmail_message_id: message.id!,
        thread_id: message.threadId || '',
        from_email: fromParsed.email || null,
        from_name: fromParsed.name || null,
        to_email: toParsed.email || null,
        to_name: toParsed.name || null,
        subject: subjectHeader || null,
        snippet: message.snippet || null,
        internal_date: internalDate,
        has_attachments: hasAttachments,
        raw_header: headers
      }
      
      messages.push(gmailMessage)
      
      // Extract attachment metadata
      if (hasAttachments) {
        for (const part of parts) {
          if (part.filename && part.body?.attachmentId) {
            const gmailAttachment: GmailAttachmentRow = {
              user_email: userEmail,
              gmail_message_id: message.id!,
              gmail_attachment_id: part.body.attachmentId,
              file_name: part.filename,
              mime_type: part.mimeType || null,
              size_bytes: part.body.size ? parseInt(part.body.size.toString()) : null
            }
            attachments.push(gmailAttachment)
          }
        }
      }
    } catch (error) {
      console.error(`Error fetching message ${msg.id}:`, error)
      // Continue with next message
    }
  }
  
  return { messages, attachments }
}

/**
 * Import a Gmail attachment as a document
 */
export async function importAttachmentAsDocument(
  userEmail: string,
  gmailAttachment: GmailAttachmentRow,
  gmailMessage: GmailMessageRow
): Promise<{ document: any; error?: string }> {
  try {
    // 1. Download attachment from Gmail
    const accessToken = await getAccessToken(userEmail)
    if (!accessToken) {
      return { document: null, error: 'Gmail not connected. Please connect your Gmail account first.' }
    }
    
    // Create Gmail client with access token
    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: accessToken })
    const gmail = google.gmail({ version: 'v1', auth })
    
    const attachmentResponse = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId: gmailAttachment.gmail_message_id,
      id: gmailAttachment.gmail_attachment_id
    })
    
    if (!attachmentResponse.data.data) {
      return { document: null, error: 'Attachment not found' }
    }
    
    // Decode base64 attachment data
    let attachmentData = attachmentResponse.data.data
    // Replace URL-safe base64 characters with standard base64
    attachmentData = attachmentData.replace(/-/g, '+').replace(/_/g, '/')
    // Add padding if needed
    while (attachmentData.length % 4) {
      attachmentData += '='
    }
    
    const buffer = Buffer.from(attachmentData, 'base64')
    
    // 2. Upload to Supabase storage
    const fileExt = gmailAttachment.file_name?.split('.').pop() || 'bin'
    const storageFileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
    const filePath = `email-attachments/${storageFileName}`
    
    const STORAGE_BUCKET = process.env.NEXT_PUBLIC_STORAGE_BUCKET || 'mb-cockpit'
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, buffer, {
        contentType: gmailAttachment.mime_type || 'application/octet-stream',
        cacheControl: '3600',
        upsert: false
      })
    
    if (uploadError || !uploadData) {
      return { document: null, error: uploadError?.message || 'Failed to upload file' }
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filePath)
    
    if (!publicUrl) {
      return { document: null, error: 'Failed to get public URL' }
    }
    
    // 3. Infer contact and organisation
    const emailContext: EmailContext = {
      from_email: gmailMessage.from_email,
      from_name: gmailMessage.from_name,
      to_email: gmailMessage.to_email,
      to_name: gmailMessage.to_name,
      subject: gmailMessage.subject,
      snippet: gmailMessage.snippet
    }
    
    const inference = await inferContactAndOrganisation(emailContext)
    
    // Helper function to get or create organisation
    const getOrCreateOrganisation = async (orgName: string): Promise<string | null> => {
      if (!orgName) return null
      
      try {
        const organisations = await getOrganisations()
        // Try exact match first
        let matchingOrg = organisations.find(org => 
          org.name.toLowerCase() === orgName.toLowerCase()
        )
        // If no exact match, try partial match
        if (!matchingOrg) {
          matchingOrg = organisations.find(org => 
            org.name.toLowerCase().includes(orgName.toLowerCase()) ||
            orgName.toLowerCase().includes(org.name.toLowerCase())
          )
        }
        
        if (matchingOrg) {
          return matchingOrg.id
        } else {
          // Create organisation if it doesn't exist
          const newOrg = await createOrganisation({
            name: orgName,
            categories: [],
            priority: 'mid',
            status: 'ongoing'
          })
          if (newOrg) {
            console.log(`✅ Created new organisation "${orgName}"`)
            return newOrg.id
          }
        }
      } catch (error) {
        console.error('Error getting/creating organisation:', error)
      }
      return null
    }
    
    // 3a. If contact is assigned, get organisation from contact
    let organisation_id = inference.organisation_id
    if (!organisation_id && inference.contact_id) {
      try {
        const contacts = await getContacts()
        const contact = contacts.find(c => c.id === inference.contact_id)
        if (contact) {
          // Get organisation from contact (check both legacy field and new array)
          const contactOrgName = contact.organizations && contact.organizations.length > 0
            ? contact.organizations[0]
            : (contact.organization || null)
          
          if (contactOrgName) {
            const orgId = await getOrCreateOrganisation(contactOrgName)
            if (orgId) {
              organisation_id = orgId
              console.log(`✅ Matched/created organisation "${contactOrgName}" from contact "${contact.name}"`)
            }
          }
        }
      } catch (error) {
        console.error('Error fetching contact organisation:', error)
      }
    }
    
    // 3b. Try to find organisation from filename if still not found
    if (!organisation_id && gmailAttachment.file_name) {
      const orgNameFromFile = extractOrganisationFromFilename(gmailAttachment.file_name)
      if (orgNameFromFile) {
        const orgId = await getOrCreateOrganisation(orgNameFromFile)
        if (orgId) {
          organisation_id = orgId
          console.log(`✅ Matched/created organisation "${orgNameFromFile}" from filename "${gmailAttachment.file_name}"`)
        }
      }
    }
    
    // 3b. Detect document type from filename/subject
    const documentType = detectDocumentType(
      gmailAttachment.file_name || '',
      gmailMessage.subject
    )
    
    // 4. Derive invoice date from internal_date
    let invoice_date: string | null = null
    let invoice_year: number | null = null
    let invoice_month: number | null = null
    
    if (gmailMessage.internal_date) {
      try {
        const date = new Date(gmailMessage.internal_date)
        invoice_date = date.toISOString().split('T')[0] // YYYY-MM-DD format
        invoice_year = date.getFullYear()
        invoice_month = date.getMonth() + 1
      } catch (e) {
        // Ignore date parsing errors
      }
    }
    
    // 5. Create document
    const documentName = gmailMessage.subject || gmailAttachment.file_name || 'Untitled Document'
    
    const document = await createDocument({
      name: documentName,
      file_url: publicUrl,
      file_type: gmailAttachment.mime_type || undefined,
      file_size: gmailAttachment.size_bytes || undefined,
      contact_id: inference.contact_id || undefined,
      organisation_id: organisation_id || undefined,
      document_type: documentType || undefined, // Auto-detect Invoice type
      source_gmail_message_id: gmailMessage.gmail_message_id,
      source_gmail_attachment_id: gmailAttachment.gmail_attachment_id,
      contact_email: inference.contact_email,
      contact_name: inference.contact_name,
      organisation_name_guess: inference.organisation_name_guess,
      invoice_date: invoice_date,
      invoice_year: invoice_year,
      invoice_month: invoice_month,
      // Invoice fields are NULL initially - user will fill them in classification view
      invoice_type: null,
      amount_original: null,
      currency: null,
      amount_base: null,
      base_currency: null
    })
    
    if (!document) {
      return { document: null, error: 'Failed to create document' }
    }
    
    // Update attachment record with file path
    await supabase
      .from('gmail_attachments')
      .update({ supabase_file_path: filePath })
      .eq('user_email', userEmail)
      .eq('gmail_attachment_id', gmailAttachment.gmail_attachment_id)
    
    return { document }
  } catch (error: any) {
    console.error('Error importing attachment:', error)
    return { document: null, error: error.message || 'Failed to import attachment' }
  }
}

