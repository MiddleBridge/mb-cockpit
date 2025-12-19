import { supabase } from '@/lib/supabase';

export interface FinanceTrip {
  id: string;
  org_id: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
  status: 'draft' | 'submitted' | 'reimbursed';
  created_at: string;
  updated_at: string;
}

export interface FinanceTripItem {
  id: string;
  org_id: string;
  trip_id: string;
  source: 'transaction' | 'manual';
  transaction_id: string | null;
  item_date: string | null;
  vendor: string | null;
  description: string | null;
  category: string | null;
  amount: number;
  currency: string;
  paid_by_company_card: boolean;
  exclude_from_reimbursement: boolean;
  created_at: string;
}

export interface FinanceTripNote {
  id: string;
  org_id: string;
  trip_id: string;
  note: string;
  created_at: string;
}

export interface FinanceTripEvidence {
  id: string;
  org_id: string;
  trip_id: string;
  trip_item_id: string | null;
  file_name: string;
  mime_type: string;
  file_size: number | null;
  storage_bucket: string;
  storage_path: string;
  created_at: string;
}

export interface FinanceTripWithStats extends FinanceTrip {
  items_count?: number;
  reimbursable_totals?: Record<string, number>; // currency -> total
  missing_evidence_count?: number;
}

/**
 * Get all trips for an organization
 */
export async function getTrips(orgId: string | null): Promise<FinanceTrip[]> {
  let query = supabase
    .from('finance_trips')
    .select('*')
    .order('created_at', { ascending: false });

  if (orgId) {
    query = query.eq('org_id', orgId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching trips:', error);
    return [];
  }

  return (data || []) as FinanceTrip[];
}

/**
 * Get trip by ID
 */
export async function getTripById(tripId: string): Promise<FinanceTrip | null> {
  const { data, error } = await supabase
    .from('finance_trips')
    .select('*')
    .eq('id', tripId)
    .single();

  if (error) {
    console.error('Error fetching trip:', error);
    return null;
  }

  return data as FinanceTrip;
}

/**
 * Create a new trip
 */
export async function createTrip(trip: Omit<FinanceTrip, 'id' | 'created_at' | 'updated_at'>): Promise<FinanceTrip | null> {
  const { data, error } = await supabase
    .from('finance_trips')
    .insert([trip])
    .select()
    .single();

  if (error) {
    console.error('Error creating trip:', error);
    return null;
  }

  return data as FinanceTrip;
}

/**
 * Update trip
 */
export async function updateTrip(tripId: string, updates: Partial<FinanceTrip>): Promise<FinanceTrip | null> {
  const { data, error } = await supabase
    .from('finance_trips')
    .update(updates)
    .eq('id', tripId)
    .select()
    .single();

  if (error) {
    console.error('Error updating trip:', error);
    return null;
  }

  return data as FinanceTrip;
}

/**
 * Delete trip (cascade will delete items, notes, evidence)
 */
export async function deleteTrip(tripId: string): Promise<boolean> {
  const { error } = await supabase
    .from('finance_trips')
    .delete()
    .eq('id', tripId);

  if (error) {
    console.error('Error deleting trip:', error);
    return false;
  }

  return true;
}

