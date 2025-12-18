import { supabase } from '@/lib/supabase';
import { isUuid } from '@/server/validators/isUuid';

/**
 * Get active organisation ID
 * 
 * Strategy:
 * 1. If orgId is provided and valid UUID, use it
 * 2. Otherwise, get first available organisation from database
 * 3. If no organisations exist, throw error
 */
export async function getActiveOrgIdOrThrow(providedOrgId?: string | null): Promise<string> {
  // If provided orgId is valid UUID, use it
  if (providedOrgId && isUuid(providedOrgId)) {
    return providedOrgId;
  }

  // Otherwise, get first available organisation
  const { data: orgs, error } = await supabase
    .from('organisations')
    .select('id')
    .limit(1)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching organisations:', error);
    throw new Error('ORG_FETCH_FAILED');
  }

  if (!orgs || orgs.length === 0) {
    throw new Error('ORG_REQUIRED');
  }

  const orgId = orgs[0].id;
  
  if (!isUuid(orgId)) {
    throw new Error('ORG_INVALID');
  }

  return orgId;
}

/**
 * Validate orgId is a valid UUID
 * Returns error code if invalid, null if valid
 */
export function validateOrgId(orgId: string | null | undefined): string | null {
  if (!orgId) {
    return 'ORG_REQUIRED';
  }
  
  if (!isUuid(orgId)) {
    return 'ORG_INVALID';
  }
  
  return null;
}

