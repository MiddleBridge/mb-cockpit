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
    const { error } = await supabase
      .from('finance_transactions')
      .update({
        category: params.category,
        subcategory: params.subcategory || null,
      })
      .eq('id', params.transactionId);

    if (error) {
      console.error('Error updating transaction category:', error);
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (error: any) {
    console.error('Error updating transaction category:', error);
    return { ok: false, error: error.message || 'Unknown error' };
  }
}

