import { supabase } from '@/lib/supabase';
import type { FinanceTripNote } from './trips';

/**
 * Get all notes for a trip
 */
export async function getTripNotes(tripId: string): Promise<FinanceTripNote[]> {
  const { data, error } = await supabase
    .from('finance_trip_notes')
    .select('*')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching trip notes:', error);
    return [];
  }

  return (data || []) as FinanceTripNote[];
}

/**
 * Create trip note
 */
export async function createTripNote(note: Omit<FinanceTripNote, 'id' | 'created_at'>): Promise<FinanceTripNote | null> {
  const { data, error } = await supabase
    .from('finance_trip_notes')
    .insert([note])
    .select()
    .single();

  if (error) {
    console.error('Error creating trip note:', error);
    return null;
  }

  return data as FinanceTripNote;
}

/**
 * Delete trip note
 */
export async function deleteTripNote(noteId: string): Promise<boolean> {
  const { error } = await supabase
    .from('finance_trip_notes')
    .delete()
    .eq('id', noteId);

  if (error) {
    console.error('Error deleting trip note:', error);
    return false;
  }

  return true;
}

