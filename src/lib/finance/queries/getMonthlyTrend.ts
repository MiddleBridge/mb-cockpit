import { supabase } from '@/lib/supabase';

export interface MonthlyTrendData {
  month: string; // YYYY-MM
  inflow: number;
  outflow: number;
  net: number;
  taxes?: {
    vat: number;
    cit: number;
    other: number;
  };
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
    .select('booking_date, amount, direction, category, description');

  if (params.orgId !== null && params.orgId !== undefined) {
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
  const byMonth: Record<string, { 
    inflow: number; 
    outflow: number;
    taxes: { vat: number; cit: number; other: number };
  }> = {};

  // Helper to detect tax categories
  const isVat = (category: string | null, description: string | null) => {
    if (!category && !description) return false;
    const cat = (category || '').toLowerCase();
    const desc = (description || '').toLowerCase();
    return cat.includes('vat') || cat.includes('podatek vat') || desc.includes('vat') || desc.includes('podatek vat');
  };

  const isCit = (category: string | null, description: string | null) => {
    if (!category && !description) return false;
    const cat = (category || '').toLowerCase();
    const desc = (description || '').toLowerCase();
    return cat.includes('cit') || cat.includes('podatek dochodowy') || desc.includes('cit') || desc.includes('podatek dochodowy');
  };

  const isTax = (category: string | null) => {
    if (!category) return false;
    const cat = category.toLowerCase();
    return cat.includes('podatek') || cat.includes('podatki') || cat.includes('tax');
  };

  transactions.forEach(t => {
    const month = t.booking_date.substring(0, 7); // YYYY-MM
    if (!byMonth[month]) {
      byMonth[month] = { inflow: 0, outflow: 0, taxes: { vat: 0, cit: 0, other: 0 } };
    }
    const amount = Math.abs(t.amount || 0);
    
    if (t.direction === 'in') {
      byMonth[month].inflow += Math.abs(amount);
    } else {
      byMonth[month].outflow += amount;
      
      // Categorize taxes
      if (isTax(t.category)) {
        if (isVat(t.category, t.description)) {
          byMonth[month].taxes.vat += amount;
        } else if (isCit(t.category, t.description)) {
          byMonth[month].taxes.cit += amount;
        } else {
          byMonth[month].taxes.other += amount;
        }
      }
    }
  });

  // Convert to array and sort
  return Object.entries(byMonth)
    .map(([month, data]) => ({
      month,
      inflow: data.inflow,
      outflow: data.outflow,
      net: data.inflow - data.outflow,
      taxes: data.taxes,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

