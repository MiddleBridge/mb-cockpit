import { supabase } from '@/lib/supabase';

export interface TopCategory {
  category: string;
  total_amount: number;
  transaction_count: number;
}

export interface GetTopCategoriesParams {
  orgId?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  limit?: number;
}

export async function getTopCategories(params: GetTopCategoriesParams): Promise<TopCategory[]> {
  let query = supabase
    .from('finance_transactions')
    .select('category, amount');

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
    console.error('Error fetching top categories:', error);
    return [];
  }

  const transactions = data || [];

  // Group by category
  const byCategory: Record<string, { total: number; count: number }> = {};

  transactions.forEach(t => {
    const cat = t.category || 'uncategorised';
    if (!byCategory[cat]) {
      byCategory[cat] = { total: 0, count: 0 };
    }
    byCategory[cat].total += Math.abs(t.amount || 0);
    byCategory[cat].count += 1;
  });

  // Convert to array, sort by absolute amount, limit
  const limit = params.limit || 10;
  return Object.entries(byCategory)
    .map(([category, data]) => ({
      category,
      total_amount: data.total,
      transaction_count: data.count,
    }))
    .sort((a, b) => b.total_amount - a.total_amount)
    .slice(0, limit);
}

