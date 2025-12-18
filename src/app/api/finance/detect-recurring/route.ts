import { NextRequest, NextResponse } from 'next/server';
import { detectAndUpdateRecurring } from '@/lib/finance/detectAndUpdateRecurring';

export async function POST(request: NextRequest) {
  try {
    const { orgId } = await request.json().catch(() => ({}));

    const result = await detectAndUpdateRecurring(orgId || null);

    return NextResponse.json({ ok: true, ...result });
  } catch (error: any) {
    console.error('[detect-recurring] Error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to detect recurring transactions' },
      { status: 500 }
    );
  }
}

