import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import * as documentsDb from '@/lib/db/documents';
import pdf from 'pdf-parse';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Get document from database
    const documents = await documentsDb.getDocuments();
    const document = documents.find(d => d.id === id);

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Check if file is PDF
    if (document.file_type !== 'application/pdf' && !document.file_url.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json(
        { error: 'Only PDF files are supported for text extraction' },
        { status: 400 }
      );
    }

    // Download file from URL
    let fileBuffer: Buffer;
    
    try {
      // Try to fetch from URL
      const response = await fetch(document.file_url);
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
    } catch (error: any) {
      // If URL fetch fails, try Supabase Storage
      try {
        // Extract path from URL if it's a Supabase Storage URL
        const url = new URL(document.file_url);
        const pathParts = url.pathname.split('/');
        const bucket = pathParts[1];
        const filePath = pathParts.slice(2).join('/');

        const { data, error: storageError } = await supabase.storage
          .from(bucket)
          .download(filePath);

        if (storageError || !data) {
          throw new Error(storageError?.message || 'Failed to download from storage');
        }

        const arrayBuffer = await data.arrayBuffer();
        fileBuffer = Buffer.from(arrayBuffer);
      } catch (storageError: any) {
        return NextResponse.json(
          { error: `Failed to download file: ${storageError.message}` },
          { status: 500 }
        );
      }
    }

    // Extract text from PDF
    const pdfData = await pdf(fileBuffer);
    const fullText = pdfData.text;

    if (!fullText || fullText.trim().length === 0) {
      return NextResponse.json(
        { error: 'No text found in PDF. The file might be a scanned image and requires OCR.' },
        { status: 400 }
      );
    }

    // Update document with extracted text
    const updated = await documentsDb.updateDocument(id, { full_text: fullText });

    if (!updated) {
      return NextResponse.json(
        { error: 'Failed to update document' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      full_text: fullText,
      textLength: fullText.length,
    });
  } catch (error: any) {
    console.error('Error extracting text from PDF:', error);
    return NextResponse.json(
      { error: 'Failed to extract text', details: error.message },
      { status: 500 }
    );
  }
}

