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
  if (params.orgId !== null && params.orgId !== undefined) {
    query = query.eq('org_id', params.orgId);
  }

  if (params.dateFrom) {
    query = query.gte('booking_date', params.dateFrom);
  }

  if (params.dateTo) {
    query = query.lte('booking_date', params.dateTo);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching KPIs:', error);
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

  // Calculate sums - handle both positive/negative amounts correctly
  // Note: direction is determined by sign of amount during import
  // 'in' = positive amount, 'out' = negative amount
  // But we store absolute values, so we need to check direction field
  const inflow_sum = transactions
    .filter(t => t.direction === 'in')
    .reduce((sum, t) => {
      const amount = Number(t.amount) || 0;
      // For 'in' direction, use positive amount (even if stored as negative, take abs)
      return sum + Math.abs(amount);
    }, 0);

  const outflow_sum = transactions
    .filter(t => t.direction === 'out')
    .reduce((sum, t) => {
      const amount = Number(t.amount) || 0;
      // For 'out' direction, use absolute value (amount might be negative)
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

