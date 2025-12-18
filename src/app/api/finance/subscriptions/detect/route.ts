import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { detectHardcoded, Transaction } from '@/lib/finance/subscriptions/detectHardcoded';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { orgId } = body;

    // Validate orgId - must be a valid UUID, not null/undefined/placeholder
    if (!orgId || typeof orgId !== 'string' || orgId === 'placeholder-org-id') {
      console.error('[detect-subscriptions] Invalid orgId:', orgId);
      return NextResponse.json(
        { ok: false, error: 'orgId is required and must be a valid UUID' },
        { status: 400 }
      );
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(orgId)) {
      console.error('[detect-subscriptions] Invalid UUID format:', orgId);
      return NextResponse.json(
        { ok: false, error: 'orgId must be a valid UUID format' },
        { status: 400 }
      );
    }

    console.info('[detect-subscriptions] Starting detection for orgId:', orgId);

    // Fetch last 18 months of expense transactions
    const dateFrom = new Date();
    dateFrom.setMonth(dateFrom.getMonth() - 18);

    const { data: transactions, error: fetchError } = await supabase
      .from('finance_transactions')
      .select('id, org_id, booking_date, description, amount, currency')
      .eq('org_id', orgId)
      .eq('direction', 'out') // Only expenses
      .gte('booking_date', dateFrom.toISOString().split('T')[0])
      .order('booking_date', { ascending: true });

    if (fetchError) {
      console.error('[detect-subscriptions] Error fetching transactions:', fetchError);
      return NextResponse.json(
        { ok: false, error: `Failed to fetch transactions: ${fetchError.message}` },
        { status: 500 }
      );
    }

    if (!transactions || transactions.length === 0) {
      console.info('[detect-subscriptions] No transactions found for orgId:', orgId);
      return NextResponse.json({
        ok: true,
        subscriptions: [],
        totalMonthly: 0,
        debug: { fetchedCount: 0, matchedCounts: {} },
      });
    }

    console.info('[detect-subscriptions] Fetched', transactions.length, 'transactions');

    // Convert to detector format
    const detectorTransactions: Transaction[] = transactions.map(tx => ({
      id: tx.id,
      org_id: tx.org_id,
      booking_date: tx.booking_date,
      description: tx.description || '',
      amount: Number(tx.amount),
      currency: tx.currency || 'PLN',
    }));

    // Run hardcoded detection
    const result = detectHardcoded(detectorTransactions);

    console.info('[detect-subscriptions] Detection complete:', {
      subscriptions: result.subscriptions.length,
      totalMonthly: result.totalMonthly,
      matched: result.debug.matchedCounts,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error: any) {
    console.error('[detect-subscriptions] Error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to detect subscriptions' },
      { status: 500 }
    );
  }
}

