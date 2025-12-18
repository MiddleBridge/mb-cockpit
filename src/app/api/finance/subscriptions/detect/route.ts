import { NextRequest, NextResponse } from 'next/server';
import { detectSubscriptions } from '@/lib/finance/subscriptions/detectSubscriptions';

export async function POST(request: NextRequest) {
  try {
    const { orgId } = await request.json().catch(() => ({}));

    if (!orgId) {
      return NextResponse.json(
        { ok: false, error: 'orgId is required' },
        { status: 400 }
      );
    }

    const result = await detectSubscriptions(orgId);

    return NextResponse.json({ ok: true, ...result });
  } catch (error: any) {
    console.error('[detect-subscriptions] Error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to detect subscriptions' },
      { status: 500 }
    );
  }
}

