import { supabase } from '@/lib/supabase';
import { detectRecurringPattern, TransactionForDetection } from './detectRecurring';

export interface DetectRecurringResult {
  processed: number;
  updated: number;
  errors: number;
}

/**
 * Detect and update recurring transactions for an organization
 */
export async function detectAndUpdateRecurring(orgId?: string | null): Promise<DetectRecurringResult> {
  console.log('[detectAndUpdateRecurring] Starting for orgId:', orgId);

  // Fetch all transactions for the org (or all if orgId is null)
  let query = supabase
    .from('finance_transactions')
    .select('id, booking_date, amount, description, is_recurring, recurrence_pattern, recurrence_group_id')
    .eq('direction', 'out') // Only outgoing payments
    .order('booking_date', { ascending: true });

  if (orgId !== null && orgId !== undefined) {
    query = query.eq('org_id', orgId);
  }

  const { data: allTransactions, error } = await query;

  if (error) {
    console.error('[detectAndUpdateRecurring] Error fetching transactions:', error);
    return { processed: 0, updated: 0, errors: 1 };
  }

  if (!allTransactions || allTransactions.length === 0) {
    console.log('[detectAndUpdateRecurring] No transactions found');
    return { processed: 0, updated: 0, errors: 0 };
  }

  console.log(`[detectAndUpdateRecurring] Processing ${allTransactions.length} transactions`);

  let processed = 0;
  let updated = 0;
  let errors = 0;

  // Process transactions in chronological order
  for (let i = 0; i < allTransactions.length; i++) {
    const currentTx = allTransactions[i];
    
    // Get all previous transactions for comparison
    const previousTransactions: TransactionForDetection[] = allTransactions
      .slice(0, i)
      .map(tx => ({
        id: tx.id,
        booking_date: tx.booking_date,
        amount: tx.amount,
        description: tx.description,
      }));

    // Detect recurring pattern
    const pattern = detectRecurringPattern(
      {
        id: currentTx.id,
        booking_date: currentTx.booking_date,
        amount: currentTx.amount,
        description: currentTx.description,
      },
      previousTransactions
    );

    // Only update if pattern is detected and confidence is reasonable
    if (pattern.pattern !== 'one_time' && pattern.confidence > 0.5) {
      // Check if update is needed
      const needsUpdate = 
        !currentTx.is_recurring ||
        currentTx.recurrence_pattern !== pattern.pattern ||
        currentTx.recurrence_group_id !== pattern.groupId;

      if (needsUpdate) {
        const { error: updateError } = await supabase
          .from('finance_transactions')
          .update({
            is_recurring: true,
            recurrence_pattern: pattern.pattern,
            recurrence_group_id: pattern.groupId,
          })
          .eq('id', currentTx.id);

        if (updateError) {
          console.error(`[detectAndUpdateRecurring] Error updating transaction ${currentTx.id}:`, updateError);
          errors++;
        } else {
          updated++;
          console.log(`[detectAndUpdateRecurring] Updated transaction ${currentTx.id}: pattern=${pattern.pattern}, groupId=${pattern.groupId}`);
        }
      }
    } else {
      // If not recurring, clear the fields if they were set
      if (currentTx.is_recurring) {
        const { error: updateError } = await supabase
          .from('finance_transactions')
          .update({
            is_recurring: false,
            recurrence_pattern: null,
            recurrence_group_id: null,
          })
          .eq('id', currentTx.id);

        if (updateError) {
          console.error(`[detectAndUpdateRecurring] Error clearing recurring fields for ${currentTx.id}:`, updateError);
          errors++;
        } else {
          updated++;
        }
      }
    }

    processed++;
  }

  console.log(`[detectAndUpdateRecurring] Complete: processed=${processed}, updated=${updated}, errors=${errors}`);

  return { processed, updated, errors };
}

