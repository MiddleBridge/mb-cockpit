'use server';

import { supabase } from '@/lib/supabase';

export interface UpdateTransactionReimbursementParams {
  transactionId: string;
  paidByCompanyCard?: boolean;
  excludeFromReimbursement?: boolean;
  projectId?: string | null;
}

export async function updateTransactionReimbursement(
  params: UpdateTransactionReimbursementParams
): Promise<{ ok: boolean; error?: string }> {
  try {
    console.log('[updateTransactionReimbursement] Updating:', params);

    const updates: any = {};
    
    if (params.paidByCompanyCard !== undefined) {
      updates.paid_by_company_card = params.paidByCompanyCard;
    }
    
    if (params.excludeFromReimbursement !== undefined) {
      updates.exclude_from_reimbursement = params.excludeFromReimbursement;
    }
    
    if ('projectId' in params) {
      updates.project_id = params.projectId;
    }

    const { data, error } = await supabase
      .from('finance_transactions')
      .update(updates)
      .eq('id', params.transactionId)
      .select('id')
      .single();

    if (error) {
      console.error('[updateTransactionReimbursement] Error:', error);
      return { ok: false, error: error.message };
    }

    console.log('[updateTransactionReimbursement] Success:', data);
    return { ok: true };
  } catch (error: any) {
    console.error('[updateTransactionReimbursement] Exception:', error);
    return { ok: false, error: error.message || 'Unknown error' };
  }
}

