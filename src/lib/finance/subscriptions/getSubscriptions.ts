import { supabase } from '@/lib/supabase';

export interface Subscription {
  id: string;
  org_id: string;
  vendor_key: string;
  display_name: string;
  cadence: string;
  currency: string;
  avg_amount: number;
  amount_tolerance: number;
  last_charge_date: string | null;
  next_expected_date: string | null;
  first_seen_date: string | null;
  active: boolean;
  confidence: number;
  source: string;
}

export interface GetSubscriptionsParams {
  orgId?: string | null;
}

export async function getSubscriptions(params: GetSubscriptionsParams): Promise<Subscription[]> {
  console.log('[getSubscriptions] Params:', params);

  let query = supabase
    .from('finance_subscriptions')
    .select('*')
    .order('active', { ascending: false })
    .order('last_charge_date', { ascending: false });

  if (params.orgId !== null && params.orgId !== undefined) {
    query = query.eq('org_id', params.orgId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[getSubscriptions] Error:', error);
    return [];
  }

  return (data || []) as Subscription[];
}

