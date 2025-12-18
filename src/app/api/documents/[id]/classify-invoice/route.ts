import { NextRequest, NextResponse } from 'next/server'
import { updateDocument } from '@/lib/db/documents'
import { supabase } from '@/lib/supabase'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params
    const { invoice_type, amount_original, currency, invoice_date } = await request.json()
    
    if (!documentId) {
      return NextResponse.json(
        { error: 'Missing document ID' },
        { status: 400 }
      )
    }
    
    if (!invoice_type || !['cost', 'revenue'].includes(invoice_type)) {
      return NextResponse.json(
        { error: 'Invalid invoice_type. Must be "cost" or "revenue"' },
        { status: 400 }
      )
    }
    
    if (!amount_original || parseFloat(amount_original.toString()) <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount_original. Must be a positive number' },
        { status: 400 }
      )
    }
    
    if (!currency) {
      return NextResponse.json(
        { error: 'Missing currency' },
        { status: 400 }
      )
    }
    
    // Get existing document to check for invoice_date or source_gmail_message_id
    const { data: existingDoc } = await supabase
      .from('documents')
      .select('invoice_date, source_gmail_message_id')
      .eq('id', documentId)
      .single()
    
    // Determine final invoice_date: use provided, or existing, or try to get from Gmail message
    let final_invoice_date: string | null = invoice_date || existingDoc?.invoice_date || null
    
    // If still no date and we have a Gmail message ID, try to get internal_date from gmail_messages
    if (!final_invoice_date && existingDoc?.source_gmail_message_id) {
      const { data: gmailMessage } = await supabase
        .from('gmail_messages')
        .select('internal_date')
        .eq('gmail_message_id', existingDoc.source_gmail_message_id)
        .single()
      
      if (gmailMessage?.internal_date) {
        try {
          const date = new Date(gmailMessage.internal_date)
          final_invoice_date = date.toISOString().split('T')[0] // YYYY-MM-DD format
        } catch (e) {
          // Ignore date parsing errors
        }
      }
    }
    
    // If still no date, use current date
    if (!final_invoice_date) {
      const now = new Date()
      final_invoice_date = now.toISOString().split('T')[0]
    }
    
    // Calculate invoice_year and invoice_month
    let invoice_year: number | null = null
    let invoice_month: number | null = null
    
    if (final_invoice_date) {
      try {
        const date = new Date(final_invoice_date)
        invoice_year = date.getFullYear()
        invoice_month = date.getMonth() + 1
      } catch (e) {
        return NextResponse.json(
          { error: 'Invalid invoice_date format' },
          { status: 400 }
        )
      }
    }
    
    // Update document
    const amountOriginalNum = parseFloat(amount_original.toString())
    const updated = await updateDocument(documentId, {
      invoice_type,
      amount_original: amountOriginalNum,
      currency,
      amount_base: amountOriginalNum, // For now 1:1 with original
      base_currency: 'PLN',
      invoice_date: final_invoice_date,
      invoice_year,
      invoice_month
    })
    
    if (!updated) {
      return NextResponse.json(
        { error: 'Failed to update document' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      document: updated
    })
  } catch (error: any) {
    console.error('Error classifying invoice:', error)
    return NextResponse.json(
      { error: 'Failed to classify invoice', details: error.message },
      { status: 500 }
    )
  }
}

