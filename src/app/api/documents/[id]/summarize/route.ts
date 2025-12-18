import { NextRequest, NextResponse } from 'next/server';
import * as documentsDb from '@/lib/db/documents';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get document from database
    const documents = await documentsDb.getDocuments();
    const document = documents.find(d => d.id === id);

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Check if full_text exists
    if (!document.full_text || document.full_text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Document has no full_text. Please extract text first.' },
        { status: 400 }
      );
    }

    // Get OpenAI API key from environment
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!openaiApiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured. Please set OPENAI_API_KEY in .env' },
        { status: 500 }
      );
    }

    // Call OpenAI to generate summary
    const prompt = `Przeanalizuj poniższy dokument i stwórz zwięzłe podsumowanie w języku polskim. Podsumowanie powinno zawierać:
1. Główne tematy i zagadnienia
2. Najważniejsze informacje i kluczowe fakty
3. Daty, liczby i inne istotne dane
4. Wnioski i rekomendacje (jeśli są)

Dokument:
${document.full_text.substring(0, 12000)}${document.full_text.length > 12000 ? '...' : ''}

Podsumowanie:`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Jesteś ekspertem w analizie dokumentów. Tworzysz zwięzłe, precyzyjne podsumowania w języku polskim.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: 'Failed to generate summary', details: errorData.error?.message || 'Unknown error' },
        { status: 500 }
      );
    }

    const data = await response.json();
    const summary = data.choices[0]?.message?.content || '';

    if (!summary || summary.trim().length === 0) {
      return NextResponse.json(
        { error: 'Empty summary generated' },
        { status: 500 }
      );
    }

    // Update document with summary
    const updated = await documentsDb.updateDocument(id, { summary });

    if (!updated) {
      return NextResponse.json(
        { error: 'Failed to update document' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      summary,
    });
  } catch (error: any) {
    console.error('Error generating summary:', error);
    return NextResponse.json(
      { error: 'Failed to generate summary', details: error.message },
      { status: 500 }
    );
  }
}

