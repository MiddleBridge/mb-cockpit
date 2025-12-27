import { supabase } from '@/lib/supabase';

export interface Kpis {
  inflow_sum: number;
  outflow_sum: number;
  net: number;
  uncategorised_count: number;
}

export interface GetKpisParams {
  orgId?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
}

export async function getKpis(params: GetKpisParams): Promise<Kpis> {
  console.log('[getKpis] Params:', params);
  
  // Build base query - select ALL needed fields
  let query = supabase
    .from('finance_transactions')
    .select('amount, direction, category, booking_date');

  // Filter by org_id ONLY if explicitly provided (not null/undefined)
  // Important: when orgId is null/undefined, we want ALL transactions (no filter)
  if (params.orgId !== null && params.orgId !== undefined && params.orgId !== '') {
    console.log('[getKpis] Filtering by org_id:', params.orgId);
    query = query.eq('org_id', params.orgId);
  } else {
    console.log('[getKpis] No org_id filter - loading ALL transactions');
  }

  if (params.dateFrom) {
    console.log('[getKpis] Filtering by dateFrom:', params.dateFrom);
    query = query.gte('booking_date', params.dateFrom);
  }

  if (params.dateTo) {
    console.log('[getKpis] Filtering by dateTo:', params.dateTo);
    query = query.lte('booking_date', params.dateTo);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[getKpis] Error fetching KPIs:', error);
    console.error('[getKpis] Error details:', JSON.stringify(error, null, 2));
    return {
      inflow_sum: 0,
      outflow_sum: 0,
      net: 0,
      uncategorised_count: 0,
    };
  }

  const transactions = data || [];
  
  console.log('[getKpis] Loaded transactions:', transactions.length);
  console.log('[getKpis] Sample transactions:', transactions.slice(0, 3));

  // Calculate sums - amount is stored as-is (can be negative for out, positive for in)
  // direction field tells us if it's in or out, but amount sign should match
  // We use direction field to be safe, and always take absolute value
  const inflow_sum = transactions
    .filter(t => t.direction === 'in')
    .reduce((sum, t) => {
      const amount = Number(t.amount) || 0;
      // For 'in', amount should be positive, but take abs to be safe
      return sum + Math.abs(amount);
    }, 0);

  const outflow_sum = transactions
    .filter(t => t.direction === 'out')
    .reduce((sum, t) => {
      const amount = Number(t.amount) || 0;
      // For 'out', amount can be negative, take abs
      return sum + Math.abs(amount);
    }, 0);

  const net = inflow_sum - outflow_sum;

  // Count uncategorised
  const uncategorised_count = transactions.filter(t => 
    !t.category || t.category === 'uncategorised' || t.category === ''
  ).length;

  console.log('[getKpis] Calculated:', { inflow_sum, outflow_sum, net, uncategorised_count });

  return {
    inflow_sum,
    outflow_sum,
    net,
    uncategorised_count,
  };
}

