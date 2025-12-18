'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useOrganisations, useCategories } from '@/app/hooks/useSharedLists';
import { useFinanceTransactionsFilters } from '@/app/hooks/useFinanceTransactionsFilters';
import * as documentsActions from '@/app/actions/documents';
import { getKpis } from '@/lib/finance/queries/getKpis';
import { getCategories as getFinanceCategories } from '@/lib/finance/queries/getCategories';
import { Transaction } from '@/lib/finance/queries/getTransactions';
import StickyTopBar from '@/components/finance/StickyTopBar';
import KpiStrip from '@/components/finance/KpiStrip';
import TransactionsWorkbench from '@/components/finance/TransactionsWorkbench';
import InsightsPanel from '@/components/finance/InsightsPanel';
import TransactionDrawer from '@/components/finance/TransactionDrawer';
import SubscriptionsPanel from '@/components/finance/SubscriptionsPanel';

export default function FinanceView() {
  const router = useRouter();
  const { organisations, loading: orgsLoading } = useOrganisations();
  const { categories: sharedCategories } = useCategories();
  const { filters, updateFilters } = useFinanceTransactionsFilters();
  
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [importStatus, setImportStatus] = useState<'idle' | 'importing' | 'complete' | 'failed'>('idle');
  const [kpis, setKpis] = useState({ inflow_sum: 0, outflow_sum: 0, net: 0, uncategorised_count: 0 });
  const [transactionCategories, setTransactionCategories] = useState<string[]>([]);
  const [loadingKpis, setLoadingKpis] = useState(true);
  const [currentTransactions, setCurrentTransactions] = useState<Transaction[]>([]);
  
  const hasOrganisations = organisations.length > 0;
  // Track selected org from URL or state
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  // Debounced search
  const [searchInput, setSearchInput] = useState(filters.search || '');
  useEffect(() => {
    const timer = setTimeout(() => {
      updateFilters({ search: searchInput || null });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Load KPIs
  useEffect(() => {
    loadKpis();
  }, [selectedOrgId, filters.dateFrom, filters.dateTo]);

  // Load transaction categories and merge with shared categories
  useEffect(() => {
    loadTransactionCategories();
  }, [selectedOrgId]);

  const loadKpis = async () => {
    setLoadingKpis(true);
    try {
      const data = await getKpis({
        orgId: selectedOrgId,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      });
      setKpis(data);
    } catch (error) {
      console.error('Error loading KPIs:', error);
    } finally {
      setLoadingKpis(false);
    }
  };

  const loadTransactionCategories = async () => {
    try {
      const data = await getFinanceCategories(selectedOrgId);
      console.log('[FinanceView] Loaded transaction categories:', data);
      setTransactionCategories(data);
    } catch (error) {
      console.error('Error loading transaction categories:', error);
    }
  };

  // Merge shared categories with transaction categories
  const allCategories = Array.from(new Set([...sharedCategories, ...transactionCategories])).sort();

  const handleUpload = async (file: File) => {
    setImportStatus('importing');
    try {
      const result = await documentsActions.uploadDocumentAndLinkToEntity(selectedOrgId, file, {
        docType: 'BANK_CONFIRMATION',
        title: file.name,
      });

      const importResult = (result as any)?.import;
      if (importResult?.ok) {
        setImportStatus('complete');
        // Refresh KPIs and reload transaction categories
        await Promise.all([
          loadKpis(),
          loadTransactionCategories(),
        ]);
        setTimeout(() => setImportStatus('idle'), 3000);
      } else {
        setImportStatus('failed');
        setTimeout(() => setImportStatus('idle'), 5000);
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      setImportStatus('failed');
      setTimeout(() => setImportStatus('idle'), 5000);
    }
  };

  const handleUncategorisedClick = useCallback(() => {
    updateFilters({ tab: 'uncategorised' });
  }, [updateFilters]);

  const handleMonthClick = useCallback((month: string) => {
    const [year, monthNum] = month.split('-');
    const dateFrom = `${year}-${monthNum}-01`;
    const lastDay = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
    const dateTo = `${year}-${monthNum}-${lastDay}`;
    updateFilters({ dateFrom, dateTo });
  }, [updateFilters]);

  const handleCategoryClick = useCallback((category: string) => {
    updateFilters({ category });
  }, [updateFilters]);

  // Memoize callback to prevent infinite loop
  const handleTransactionsLoaded = useCallback((transactions: Transaction[]) => {
    // Store current transactions for subscription detection
    setCurrentTransactions(transactions);
  }, []);

  if (!hasOrganisations && !orgsLoading) {
    return (
      <div className="h-full flex flex-col bg-neutral-900 text-white">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-neutral-400 text-sm mb-4">
              Brak organizacji. Najpierw utwórz organizację w sekcji "Organisations".
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-neutral-900 text-white">
      {/* Sticky Top Bar */}
      <StickyTopBar
        onSearchChange={setSearchInput}
        onDateRangeChange={(from, to) => updateFilters({ dateFrom: from, dateTo: to })}
        onOrgChange={(orgId) => {
          setSelectedOrgId(orgId);
        }}
        onClearFilters={() => {
          updateFilters({
            dateFrom: null,
            dateTo: null,
            search: null,
            category: null,
            direction: null,
            tab: 'all',
          });
          setSearchInput('');
        }}
        onUpload={handleUpload}
        importStatus={importStatus}
        searchValue={searchInput}
        dateFrom={filters.dateFrom}
        dateTo={filters.dateTo}
        selectedOrgId={selectedOrgId}
      />

      {/* KPI Strip */}
      <KpiStrip
        inflow={kpis.inflow_sum}
        outflow={kpis.outflow_sum}
        net={kpis.net}
        uncategorisedCount={kpis.uncategorised_count}
        onUncategorisedClick={handleUncategorisedClick}
      />

      {/* Subscriptions Panel */}
      <div className="px-4 pt-2">
        <SubscriptionsPanel orgId={selectedOrgId} transactions={currentTransactions} />
      </div>

      {/* Main Content - Two Columns */}
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-12 gap-4 p-4">
          {/* Left Column - Transactions Workbench */}
          <div className="col-span-12 lg:col-span-8">
            <TransactionsWorkbench
              orgId={selectedOrgId}
              filters={filters}
              onTabChange={(tab) => updateFilters({ tab })}
              onCategoryFilterChange={(category) => updateFilters({ category })}
              onDirectionFilterChange={(direction) => updateFilters({ direction })}
              onTransactionClick={setSelectedTransaction}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              categories={allCategories}
              onDataChange={() => {
                // Refresh KPIs and categories when transactions change
                loadKpis();
                loadTransactionCategories();
              }}
              onTransactionsLoaded={handleTransactionsLoaded}
            />
          </div>

          {/* Right Column - Insights Panel */}
          <div className="col-span-12 lg:col-span-4">
            <InsightsPanel
              orgId={selectedOrgId}
              dateFrom={filters.dateFrom}
              dateTo={filters.dateTo}
              onMonthClick={handleMonthClick}
              onCategoryClick={handleCategoryClick}
            />
          </div>
        </div>
      </div>

      {/* Transaction Drawer */}
      {selectedTransaction && (
        <TransactionDrawer
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
          categories={allCategories}
        />
      )}
    </div>
  );
}
