import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAccessToken } from '@/lib/gmail';
import { supabase } from '@/lib/supabase';
import { createDocument } from '@/lib/db/documents';

export async function POST(request: NextRequest) {
  try {
    const { 
      messageId, 
      attachmentId, 
      userEmail, 
      contactId, 
      organisationId, 
      projectId, 
      fileName, 
      mimeType,
      invoiceType,
      taxType,
      amountOriginal,
      currency,
      invoiceDate,
      invoiceYear,
      invoiceMonth,
      emailSubject,
      emailDate
    } = await request.json();

    if (!messageId || !attachmentId || !userEmail || !fileName) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
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

    // Decode base64 attachment data
    const attachmentData = attachmentResponse.data.data;
    const buffer = Buffer.from(attachmentData, 'base64');

    // Upload directly to Supabase Storage using buffer
    // Supabase storage accepts ArrayBuffer, so we'll use the buffer directly
    const fileExt = fileName.split('.').pop() || 'bin';
    const storageFileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `email-attachments/${storageFileName}`;

    const STORAGE_BUCKET = process.env.NEXT_PUBLIC_STORAGE_BUCKET || 'mb-cockpit';
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, buffer, {
        contentType: mimeType || 'application/octet-stream',
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError || !uploadData) {
      console.error('Error uploading to Supabase:', uploadError);
      return NextResponse.json(
        { error: uploadError?.message || 'Failed to upload file' },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filePath);

    if (!publicUrl) {
      return NextResponse.json(
        { error: 'Failed to get public URL' },
        { status: 500 }
      );
    }

    // Calculate invoice_year and invoice_month if invoice/tax data is provided
    let invoice_year: number | undefined = undefined;
    let invoice_month: number | undefined = undefined;
    if ((invoiceType || taxType) && (invoiceDate || (invoiceYear && invoiceMonth))) {
      if (invoiceYear && invoiceMonth) {
        invoice_year = invoiceYear;
        invoice_month = invoiceMonth;
      } else if (invoiceDate) {
        const date = new Date(invoiceDate);
        invoice_year = date.getFullYear();
        invoice_month = date.getMonth() + 1;
      }
    }

    // Determine document name - use email subject if provided, otherwise fileName
    const documentName = emailSubject || fileName;

    // Create document in database
    const document = await createDocument({
      name: documentName,
      file_url: publicUrl,
      file_type: mimeType || undefined,
      organisation_id: organisationId || undefined,
      contact_id: contactId || undefined,
      project_id: projectId || undefined,
      invoice_type: invoiceType || undefined,
      tax_type: taxType || undefined,
      amount_original: (invoiceType || taxType) && amountOriginal ? parseFloat(amountOriginal.toString()) : undefined,
      currency: (invoiceType || taxType) && currency ? currency : undefined,
      amount_base: (invoiceType || taxType) && amountOriginal ? parseFloat(amountOriginal.toString()) : undefined, // For now same as original
      base_currency: (invoiceType || taxType) ? 'PLN' : undefined,
      invoice_date: (invoiceType || taxType) && invoiceDate ? invoiceDate : undefined,
      invoice_year: invoice_year,
      invoice_month: invoice_month,
      source_gmail_message_id: messageId,
      source_gmail_attachment_id: attachmentId,
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Failed to create document' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      document,
      url: publicUrl,
    });
  } catch (error: any) {
    console.error('Error saving attachment:', error);
    return NextResponse.json(
      { error: 'Failed to save attachment', details: error.message },
      { status: 500 }
    );
  }
}

