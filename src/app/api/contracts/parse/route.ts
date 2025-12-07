import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../../lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { documentId, storagePath } = await request.json()

    if (!documentId || !storagePath) {
      return NextResponse.json(
        { error: 'documentId and storagePath are required' },
        { status: 400 }
      )
    }

    // Download file from Storage (use the same bucket as other documents)
    const bucket = process.env.NEXT_PUBLIC_STORAGE_BUCKET || 'mb-cockpit'
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(bucket)
      .download(storagePath)

    if (downloadError || !fileData) {
      console.error('Error downloading file:', downloadError)
      return NextResponse.json(
        { error: 'Failed to download file from storage' },
        { status: 500 }
      )
    }

    // Convert Blob to Buffer
    const arrayBuffer = await fileData.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Parse PDF (dynamic import to avoid build issues)
    const pdfParse = (await import('pdf-parse')).default
    const parsed = await pdfParse(buffer)

    // Update document with parsed text
    const { error: updateError } = await supabase
      .from('organisation_documents')
      .update({ parsed_text: parsed.text })
      .eq('id', documentId)

    if (updateError) {
      console.error('Error updating document:', updateError)
      return NextResponse.json(
        { error: 'Failed to update document with parsed text' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, textLength: parsed.text.length })
  } catch (error) {
    console.error('Error parsing PDF:', error)
    return NextResponse.json(
      { error: 'Failed to parse PDF' },
      { status: 500 }
    )
  }
}

