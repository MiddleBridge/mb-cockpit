import { supabase } from '@/lib/supabase';
import type { FinanceTripEvidence } from './trips';

/**
 * Get evidence for a trip item
 */
export async function getTripEvidenceByItem(tripItemId: string): Promise<FinanceTripEvidence[]> {
  const { data, error } = await supabase
    .from('finance_trip_evidence')
    .select('*')
    .eq('trip_item_id', tripItemId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching trip evidence:', error);
    return [];
  }

  return (data || []) as FinanceTripEvidence[];
}

/**
 * Get all evidence for a trip
 */
export async function getTripEvidenceByTrip(tripId: string): Promise<FinanceTripEvidence[]> {
  const { data, error } = await supabase
    .from('finance_trip_evidence')
    .select('*')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching trip evidence:', error);
    return [];
  }

  return (data || []) as FinanceTripEvidence[];
}

/**
 * Create trip evidence record
 */
export async function createTripEvidence(evidence: Omit<FinanceTripEvidence, 'id' | 'created_at'>): Promise<FinanceTripEvidence | null> {
  const { data, error } = await supabase
    .from('finance_trip_evidence')
    .insert([evidence])
    .select()
    .single();

  if (error) {
    console.error('Error creating trip evidence:', error);
    return null;
  }

  return data as FinanceTripEvidence;
}

/**
 * Delete trip evidence
 */
export async function deleteTripEvidence(evidenceId: string): Promise<boolean> {
  const { error } = await supabase
    .from('finance_trip_evidence')
    .delete()
    .eq('id', evidenceId);

  if (error) {
    console.error('Error deleting trip evidence:', error);
    return false;
  }

  return true;
}

