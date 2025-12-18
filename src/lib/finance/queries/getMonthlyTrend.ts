import { supabase } from '@/lib/supabase';

export interface MonthlyTrendData {
  month: string; // YYYY-MM
  inflow: number;
  outflow: number;
  net: number;
}

export interface GetMonthlyTrendParams {
  orgId?: string | null;
  months?: number; // Number of months to fetch (default 12)
}

export async function getMonthlyTrend(params: GetMonthlyTrendParams): Promise<MonthlyTrendData[]> {
  const months = params.months || 12;
  const dateFrom = new Date();
  dateFrom.setMonth(dateFrom.getMonth() - months);
  const dateFromStr = dateFrom.toISOString().substring(0, 10);

  let query = supabase
    .from('finance_transactions')
    .select('booking_date, amount, direction');

  if (params.orgId) {
    query = query.eq('org_id', params.orgId);
  }

  query = query.gte('booking_date', dateFromStr)
    .order('booking_date', { ascending: true });

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching monthly trend:', error);
    return [];
  }

  const transactions = data || [];

  // Group by month
  const byMonth: Record<string, { inflow: number; outflow: number }> = {};

  transactions.forEach(t => {
    const month = t.booking_date.substring(0, 7); // YYYY-MM
    if (!byMonth[month]) {
      byMonth[month] = { inflow: 0, outflow: 0 };
    }
    if (t.direction === 'in') {
      byMonth[month].inflow += t.amount || 0;
    } else {
      byMonth[month].outflow += Math.abs(t.amount || 0);
    }
  });

  // Convert to array and sort
  return Object.entries(byMonth)
    .map(([month, data]) => ({
      month,
      inflow: data.inflow,
      outflow: data.outflow,
      net: data.inflow - data.outflow,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

