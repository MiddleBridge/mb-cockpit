import { supabase } from '@/lib/supabase';

export interface Subscription {
  recurrence_group_id: string;
  description: string;
  counterparty_name: string | null;
  recurrence_pattern: 'monthly' | 'quarterly' | 'yearly' | 'weekly';
  first_transaction_date: string;
  last_transaction_date: string;
  min_amount: number;
  max_amount: number;
  currency: string;
  transaction_count: number;
  is_active: boolean; // true if last transaction is within expected interval
}

export interface GetSubscriptionsParams {
  orgId?: string | null;
}

export async function getSubscriptions(params: GetSubscriptionsParams): Promise<Subscription[]> {
  console.log('[getSubscriptions] Params:', params);
  
  let query = supabase
    .from('finance_transactions')
    .select('id, booking_date, amount, currency, description, counterparty_name, recurrence_group_id, recurrence_pattern')
    .eq('is_recurring', true)
    .not('recurrence_group_id', 'is', null)
    .not('recurrence_pattern', 'is', null)
    .eq('direction', 'out'); // Only outgoing payments (subscriptions are expenses)

  // Filter by org_id ONLY if explicitly provided
  if (params.orgId !== null && params.orgId !== undefined) {
    query = query.eq('org_id', params.orgId);
  }

  // Order by date
  query = query.order('booking_date', { ascending: true });

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching subscriptions:', error);
    return [];
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Group transactions by recurrence_group_id
  const groups = new Map<string, typeof data>();
  for (const tx of data) {
    if (!tx.recurrence_group_id) continue;
    if (!groups.has(tx.recurrence_group_id)) {
      groups.set(tx.recurrence_group_id, []);
    }
    groups.get(tx.recurrence_group_id)!.push(tx);
  }

  // Convert groups to subscriptions
  const subscriptions: Subscription[] = [];
  const now = new Date();

  for (const [groupId, transactions] of groups.entries()) {
    if (transactions.length < 2) continue; // Need at least 2 transactions to be a subscription

    // Sort by date
    transactions.sort((a, b) => 
      new Date(a.booking_date).getTime() - new Date(b.booking_date).getTime()
    );

    const firstTx = transactions[0];
    const lastTx = transactions[transactions.length - 1];
    const amounts = transactions.map(tx => Math.abs(tx.amount));
    const minAmount = Math.min(...amounts);
    const maxAmount = Math.max(...amounts);

    // Determine if subscription is active
    // Check if last transaction is within expected interval
    const lastDate = new Date(lastTx.booking_date);
    const daysSinceLast = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    
    let isActive = false;
    const pattern = firstTx.recurrence_pattern;
    if (pattern === 'monthly') {
      isActive = daysSinceLast <= 45; // Allow some tolerance (30 days + 15 days buffer)
    } else if (pattern === 'quarterly') {
      isActive = daysSinceLast <= 100; // ~90 days + buffer
    } else if (pattern === 'yearly') {
      isActive = daysSinceLast <= 380; // ~365 days + buffer
    } else if (pattern === 'weekly') {
      isActive = daysSinceLast <= 14; // ~7 days + buffer
    }

    subscriptions.push({
      recurrence_group_id: groupId,
      description: firstTx.description,
      counterparty_name: firstTx.counterparty_name,
      recurrence_pattern: pattern as 'monthly' | 'quarterly' | 'yearly' | 'weekly',
      first_transaction_date: firstTx.booking_date,
      last_transaction_date: lastTx.booking_date,
      min_amount: minAmount,
      max_amount: maxAmount,
      currency: firstTx.currency,
      transaction_count: transactions.length,
      is_active: isActive,
    });
  }

  // Sort: active first, then by last transaction date (most recent first)
  subscriptions.sort((a, b) => {
    if (a.is_active !== b.is_active) {
      return a.is_active ? -1 : 1;
    }
    return new Date(b.last_transaction_date).getTime() - new Date(a.last_transaction_date).getTime();
  });

  return subscriptions;
}

