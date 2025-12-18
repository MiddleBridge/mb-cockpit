import { supabase } from '@/lib/supabase';

export interface GetTransactionsParams {
  orgId?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  search?: string | null;
  tab?: 'all' | 'uncategorised' | 'needs_review';
  category?: string | null;
  direction?: 'in' | 'out' | null;
  limit?: number;
  offset?: number;
}

export interface Transaction {
  id: string;
  org_id: string;
  source_document_id: string;
  booking_date: string;
  value_date: string | null;
  amount: number;
  currency: string;
  description: string;
  counterparty_name: string | null;
  counterparty_account: string | null;
  direction: 'in' | 'out';
  category: string;
  subcategory: string | null;
  transaction_hash: string;
  raw: Record<string, any>;
  created_at: string;
}

export interface GetTransactionsResult {
  transactions: Transaction[];
  total: number;
}

export async function getTransactions(params: GetTransactionsParams): Promise<GetTransactionsResult> {
  console.log('[getTransactions] Params:', params);
  
  let query = supabase
    .from('finance_transactions')
    .select('*', { count: 'exact', head: false });

  // Filter by org_id ONLY if explicitly provided (not null/undefined)
  // If orgId is null/undefined, show ALL transactions
  if (params.orgId !== null && params.orgId !== undefined) {
    query = query.eq('org_id', params.orgId);
  }

  // Date range filter
  if (params.dateFrom) {
    query = query.gte('booking_date', params.dateFrom);
  }
  if (params.dateTo) {
    query = query.lte('booking_date', params.dateTo);
  }

  // Direction filter
  if (params.direction) {
    query = query.eq('direction', params.direction);
  }

  // Category filter
  if (params.category) {
    query = query.eq('category', params.category);
  }

  // Tab filters
  if (params.tab === 'uncategorised') {
    query = query.or('category.is.null,category.eq.uncategorised,category.eq.');
  } else if (params.tab === 'needs_review') {
    query = query.or('counterparty_name.is.null,counterparty_name.eq.');
  }

  // Search filter (matches description and counterparty_name)
  if (params.search && params.search.trim()) {
    const searchTerm = params.search.trim();
    query = query.or(`description.ilike.%${searchTerm}%,counterparty_name.ilike.%${searchTerm}%`);
  }

  // Ordering
  query = query.order('booking_date', { ascending: false })
    .order('created_at', { ascending: false });

  // Pagination - increase default limit to show more transactions
  const limit = params.limit || 1000;
  const offset = params.offset || 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching transactions:', error);
    return { transactions: [], total: 0 };
  }

  return {
    transactions: (data as Transaction[]) || [],
    total: count || 0,
  };
}

