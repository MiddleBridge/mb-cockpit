import { NextRequest, NextResponse } from 'next/server';
import { getSubscriptions } from '@/lib/finance/subscriptions/getSubscriptions';

export async function POST(request: NextRequest) {
  try {
    const { orgId } = await request.json().catch(() => ({}));

    const subscriptions = await getSubscriptions({ orgId: orgId || null });

    return NextResponse.json({ ok: true, subscriptions });
  } catch (error: any) {
    console.error('[get-subscriptions] Error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to get subscriptions' },
      { status: 500 }
    );
  }
}

