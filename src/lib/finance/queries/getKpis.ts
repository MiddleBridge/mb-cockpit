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
  // Build base query
  let query = supabase
    .from('finance_transactions')
    .select('amount, direction, category');

  if (params.orgId) {
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

  // Calculate sums
  const inflow_sum = transactions
    .filter(t => t.direction === 'in')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const outflow_sum = transactions
    .filter(t => t.direction === 'out')
    .reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);

  const net = inflow_sum - outflow_sum;

  // Count uncategorised
  const uncategorised_count = transactions.filter(t => 
    !t.category || t.category === 'uncategorised' || t.category === ''
  ).length;

  return {
    inflow_sum,
    outflow_sum,
    net,
    uncategorised_count,
  };
}

