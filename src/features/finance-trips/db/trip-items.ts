import { supabase } from '@/lib/supabase';
import type { FinanceTripItem } from './trips';

export type { FinanceTripItem };

/**
 * Get all trip items for a trip
 */
export async function getTripItems(tripId: string): Promise<FinanceTripItem[]> {
  const { data, error } = await supabase
    .from('finance_trip_items')
    .select('*')
    .eq('trip_id', tripId)
    .order('item_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching trip items:', error);
    return [];
  }

  return (data || []) as FinanceTripItem[];
}

/**
 * Create trip item
 */
export async function createTripItem(item: Omit<FinanceTripItem, 'id' | 'created_at'>): Promise<FinanceTripItem | null> {
  const { data, error } = await supabase
    .from('finance_trip_items')
    .insert([item])
    .select()
    .single();

  if (error) {
    console.error('Error creating trip item:', error);
    return null;
  }

  return data as FinanceTripItem;
}

/**
 * Update trip item
 */
export async function updateTripItem(itemId: string, updates: Partial<FinanceTripItem>): Promise<FinanceTripItem | null> {
  const { data, error } = await supabase
    .from('finance_trip_items')
    .update(updates)
    .eq('id', itemId)
    .select()
    .single();

  if (error) {
    console.error('Error updating trip item:', error);
    return null;
  }

  return data as FinanceTripItem;
}

/**
 * Delete trip item
 */
export async function deleteTripItem(itemId: string): Promise<boolean> {
  const { error } = await supabase
    .from('finance_trip_items')
    .delete()
    .eq('id', itemId);

  if (error) {
    console.error('Error deleting trip item:', error);
    return false;
  }

  return true;
}

/**
 * Get used transaction IDs (to exclude from "Add from Transactions")
 */
export async function getUsedTransactionIds(): Promise<string[]> {
  const { data, error } = await supabase
    .from('finance_trip_items')
    .select('transaction_id')
    .not('transaction_id', 'is', null);

  if (error) {
    console.error('Error fetching used transaction IDs:', error);
    return [];
  }

  return (data || []).map(item => item.transaction_id).filter(Boolean) as string[];
}

