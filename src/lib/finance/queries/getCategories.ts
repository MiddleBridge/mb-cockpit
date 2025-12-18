import { supabase } from '@/lib/supabase';

export async function getCategories(orgId?: string | null): Promise<string[]> {
  let query = supabase
    .from('finance_transactions')
    .select('category');

  if (orgId) {
    query = query.eq('org_id', orgId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching categories:', error);
    return [];
  }

  const categories = new Set<string>();
  (data || []).forEach(t => {
    if (t.category && t.category !== '') {
      categories.add(t.category);
    }
  });

  return Array.from(categories).sort();
}

