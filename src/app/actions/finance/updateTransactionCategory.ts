'use server';

import { supabase } from '@/lib/supabase';

export interface UpdateTransactionCategoryParams {
  transactionId: string;
  category: string;
  subcategory?: string | null;
}

export async function updateTransactionCategory(
  params: UpdateTransactionCategoryParams
): Promise<{ ok: boolean; error?: string }> {
  try {
    console.log('[updateTransactionCategory] Updating:', {
      transactionId: params.transactionId,
      category: params.category,
      subcategory: params.subcategory,
    });

    const { data, error } = await supabase
      .from('finance_transactions')
      .update({
        category: params.category,
        subcategory: params.subcategory || null,
      })
      .eq('id', params.transactionId)
      .select('id, category')
      .single();

    if (error) {
      console.error('[updateTransactionCategory] Error:', error);
      return { ok: false, error: error.message };
    }

    console.log('[updateTransactionCategory] Success:', data);
    return { ok: true };
  } catch (error: any) {
    console.error('[updateTransactionCategory] Exception:', error);
    return { ok: false, error: error.message || 'Unknown error' };
  }
}

