'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useCallback } from 'react';

export interface FinanceTransactionsFilters {
  tab: 'all' | 'uncategorised' | 'needs_review';
  dateFrom: string | null;
  dateTo: string | null;
  search: string | null;
  category: string | null;
  direction: 'in' | 'out' | null;
}

export function useFinanceTransactionsFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const filters: FinanceTransactionsFilters = {
    tab: (searchParams.get('tab') as any) || 'all',
    dateFrom: searchParams.get('from'),
    dateTo: searchParams.get('to'),
    search: searchParams.get('search') ? decodeURIComponent(searchParams.get('search')!) : null,
    category: searchParams.get('category') ? decodeURIComponent(searchParams.get('category')!) : null,
    direction: searchParams.get('direction') as 'in' | 'out' | null,
  };

  const updateFilters = useCallback((updates: Partial<FinanceTransactionsFilters>) => {
    const params = new URLSearchParams(searchParams.toString());

    if (updates.tab !== undefined) {
      if (updates.tab === 'all') {
        params.delete('tab');
      } else {
        params.set('tab', updates.tab);
      }
    }

    if (updates.dateFrom !== undefined) {
      if (updates.dateFrom) {
        params.set('from', updates.dateFrom);
      } else {
        params.delete('from');
      }
    }

    if (updates.dateTo !== undefined) {
      if (updates.dateTo) {
        params.set('to', updates.dateTo);
      } else {
        params.delete('to');
      }
    }

    if (updates.search !== undefined) {
      if (updates.search) {
        params.set('search', encodeURIComponent(updates.search));
      } else {
        params.delete('search');
      }
    }

    if (updates.category !== undefined) {
      if (updates.category) {
        params.set('category', encodeURIComponent(updates.category));
      } else {
        params.delete('category');
      }
    }

    if (updates.direction !== undefined) {
      if (updates.direction) {
        params.set('direction', updates.direction);
      } else {
        params.delete('direction');
      }
    }

    router.push(`?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  return { filters, updateFilters };
}

