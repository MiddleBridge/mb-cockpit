'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getTransactions, Transaction } from '@/lib/finance/queries/getTransactions';
import { updateTransactionCategory } from '@/app/actions/finance/updateTransactionCategory';

interface TransactionsWorkbenchProps {
  orgId: string | null;
  filters: {
    tab: 'all' | 'uncategorised' | 'needs_review';
    dateFrom: string | null;
    dateTo: string | null;
    search: string | null;
    category: string | null;
    direction: 'in' | 'out' | null;
  };
  onTabChange: (tab: 'all' | 'uncategorised' | 'needs_review') => void;
  onCategoryFilterChange: (category: string | null) => void;
  onDirectionFilterChange: (direction: 'in' | 'out' | null) => void;
  onTransactionClick: (transaction: Transaction) => void;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  categories: string[];
  onDataChange?: () => void; // Callback when data changes (for parent to refresh KPIs, etc.)
  onTransactionsLoaded?: (transactions: Transaction[]) => void; // Callback to pass transactions to parent
}

export default function TransactionsWorkbench({
  orgId,
  filters,
  onTabChange,
  onCategoryFilterChange,
  onDirectionFilterChange,
  onTransactionClick,
  selectedIds,
  onSelectionChange,
  categories,
  onDataChange,
  onTransactionsLoaded,
}: TransactionsWorkbenchProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getTransactions({
        orgId,
        ...filters,
      });
      setTransactions(result.transactions);
      // Notify parent about loaded transactions
      if (onTransactionsLoaded) {
        onTransactionsLoaded(result.transactions);
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  }, [orgId, filters.tab, filters.dateFrom, filters.dateTo, filters.search, filters.category, filters.direction, onTransactionsLoaded]);

  // Load transactions when filters change
  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const handleCategoryUpdate = async (transactionId: string, category: string) => {
    setEditingCategory(transactionId);
    try {
      const result = await updateTransactionCategory({
        transactionId,
        category,
      });
      if (result.ok) {
        // Reload from database to ensure consistency
        await loadTransactions();
        // Notify parent to refresh KPIs and other data
        onDataChange?.();
      } else {
        console.error('Failed to update category:', result.error);
        alert(`Błąd podczas zapisywania kategorii: ${result.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Error updating category:', error);
      alert(`Błąd podczas zapisywania kategorii: ${error.message || 'Unknown error'}`);
    } finally {
      setEditingCategory(null);
    }
  };

  const handleBulkCategoryUpdate = async (category: string) => {
    try {
      // Update all selected transactions
      const updatePromises = selectedIds.map(id => 
        updateTransactionCategory({ transactionId: id, category })
      );
      const results = await Promise.all(updatePromises);
      
      // Check if all succeeded
      const allOk = results.every(r => r.ok);
      if (allOk) {
        // Reload from database
        await loadTransactions();
        // Notify parent to refresh KPIs and other data
        onDataChange?.();
        onSelectionChange([]);
      } else {
        const errors = results.filter(r => !r.ok).map(r => r.error);
        console.error('Some bulk updates failed:', errors);
        alert(`Niektóre kategorie nie zostały zaktualizowane: ${errors.join(', ')}`);
        // Still reload to show current state
        await loadTransactions();
        onDataChange?.();
        onSelectionChange([]);
      }
    } catch (error: any) {
      console.error('Error in bulk category update:', error);
      alert(`Błąd podczas masowej aktualizacji kategorii: ${error.message || 'Unknown error'}`);
    }
  };

  const toggleSelection = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter(i => i !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const toggleAllSelection = () => {
    if (selectedIds.length === transactions.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(transactions.map(t => t.id));
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pl-PL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: currency || 'PLN',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // Log categories for debugging
  useEffect(() => {
    console.log('[TransactionsWorkbench] Categories received:', categories);
  }, [categories]);

  // Get uncategorised count
  const uncategorisedCount = transactions.filter(t => 
    !t.category || t.category === 'uncategorised' || t.category === ''
  ).length;

  // Get needs review count - placeholder for now (no counterparty field)
  const needsReviewCount = transactions.filter(t => 
    !t.category || t.category === 'uncategorised' || t.category === ''
  ).length;

  return (
    <div className="space-y-3">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-neutral-800">
        <button
          onClick={() => onTabChange('all')}
          className={`px-3 py-2 text-xs font-medium ${
            filters.tab === 'all'
              ? 'text-white border-b-2 border-blue-500'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          Wszystkie
        </button>
        <button
          onClick={() => onTabChange('uncategorised')}
          className={`px-3 py-2 text-xs font-medium ${
            filters.tab === 'uncategorised'
              ? 'text-white border-b-2 border-blue-500'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          Nieskategoryzowane {uncategorisedCount > 0 && `(${uncategorisedCount})`}
        </button>
        <button
          onClick={() => onTabChange('needs_review')}
          className={`px-3 py-2 text-xs font-medium ${
            filters.tab === 'needs_review'
              ? 'text-white border-b-2 border-blue-500'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          Wymaga sprawdzenia {needsReviewCount > 0 && `(${needsReviewCount})`}
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <select
          value={filters.category || ''}
          onChange={(e) => onCategoryFilterChange(e.target.value || null)}
          className="text-xs bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-neutral-300"
        >
          <option value="">Wszystkie kategorie</option>
          {categories.length > 0 ? (
            categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))
          ) : (
            <option disabled>Brak kategorii</option>
          )}
        </select>
        <div className="flex gap-1">
          <button
            onClick={() => onDirectionFilterChange(null)}
            className={`text-xs px-2 py-1 rounded ${
              !filters.direction
                ? 'bg-blue-600 text-white'
                : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
            }`}
          >
            Wszystkie
          </button>
          <button
            onClick={() => onDirectionFilterChange('in')}
            className={`text-xs px-2 py-1 rounded ${
              filters.direction === 'in'
                ? 'bg-green-600 text-white'
                : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
            }`}
          >
            Przychód
          </button>
          <button
            onClick={() => onDirectionFilterChange('out')}
            className={`text-xs px-2 py-1 rounded ${
              filters.direction === 'out'
                ? 'bg-red-600 text-white'
                : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
            }`}
          >
            Wydatki
          </button>
        </div>
        {(filters.category || filters.direction) && (
          <button
            onClick={() => {
              onCategoryFilterChange(null);
              onDirectionFilterChange(null);
            }}
            className="text-xs text-neutral-400 hover:text-white"
          >
            Wyczyść filtry
          </button>
        )}
      </div>

      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-2 p-2 bg-neutral-800 rounded border border-neutral-700">
          <span className="text-xs text-neutral-300">Wybrano: {selectedIds.length}</span>
          <select
            onChange={(e) => {
              if (e.target.value) {
                handleBulkCategoryUpdate(e.target.value);
              }
            }}
            className="text-xs bg-neutral-700 border border-neutral-600 rounded px-2 py-1 text-neutral-300"
            defaultValue=""
          >
            <option value="">Przypisz kategorię</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <button
            onClick={() => onSelectionChange([])}
            className="text-xs text-neutral-400 hover:text-white"
          >
            Anuluj
          </button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="text-center py-8 text-neutral-400 text-sm">Ładowanie...</div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-8 text-neutral-400 text-sm">Brak transakcji</div>
      ) : (() => {
        // Group transactions by month
        const groupedByMonth: Record<string, Transaction[]> = {};
        transactions.forEach((transaction) => {
          const month = transaction.booking_date.substring(0, 7); // YYYY-MM
          if (!groupedByMonth[month]) {
            groupedByMonth[month] = [];
          }
          groupedByMonth[month].push(transaction);
        });

        // Sort months descending (newest first)
        const months = Object.keys(groupedByMonth).sort().reverse();

        // Format month name
        const formatMonthName = (month: string) => {
          const [year, monthNum] = month.split('-');
          const date = new Date(parseInt(year), parseInt(monthNum) - 1);
          return date.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
        };

        // Calculate month totals
        const getMonthTotals = (monthTransactions: Transaction[]) => {
          const inflow = monthTransactions
            .filter(t => t.direction === 'in')
            .reduce((sum, t) => sum + Math.abs(t.amount), 0);
          const outflow = monthTransactions
            .filter(t => t.direction === 'out')
            .reduce((sum, t) => sum + Math.abs(t.amount), 0);
          return { inflow, outflow, net: inflow - outflow };
        };

        return (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-neutral-800">
                  <th className="text-left py-2 px-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === transactions.length && transactions.length > 0}
                      onChange={toggleAllSelection}
                      className="w-3 h-3"
                    />
                  </th>
                <th className="text-left py-2 px-2 text-neutral-400 font-medium">Data</th>
                <th className="text-left py-2 px-2 text-neutral-400 font-medium">Opis</th>
                <th className="text-right py-2 px-2 text-neutral-400 font-medium">Kwota</th>
                  <th className="text-left py-2 px-2 text-neutral-400 font-medium">Kategoria</th>
                  <th className="text-left py-2 px-2 text-neutral-400 font-medium">Dokument</th>
                </tr>
              </thead>
              <tbody>
                {months.map((month) => {
                  const monthTransactions = groupedByMonth[month];
                  const totals = getMonthTotals(monthTransactions);
                  return (
                    <React.Fragment key={month}>
                      {/* Month header row */}
                      <tr className="bg-neutral-800/50 border-b border-neutral-700">
                        <td colSpan={6} className="py-2 px-3">
                          <div className="flex items-center justify-between">
                            <div className="font-semibold text-white">
                              {formatMonthName(month)}
                            </div>
                            <div className="flex items-center gap-4 text-xs">
                              <span className="text-green-400">
                                Przychód: {formatCurrency(totals.inflow, 'PLN')}
                              </span>
                              <span className="text-red-400">
                                Wydatki: {formatCurrency(totals.outflow, 'PLN')}
                              </span>
                              <span className={`font-medium ${
                                totals.net >= 0 ? 'text-green-400' : 'text-red-400'
                              }`}>
                                Saldo: {formatCurrency(totals.net, 'PLN')}
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>
                      {/* Transactions for this month */}
                      {monthTransactions.map((transaction) => (
                <tr
                  key={transaction.id}
                  onClick={() => onTransactionClick(transaction)}
                  className="border-b border-neutral-800 hover:bg-neutral-800/50 cursor-pointer"
                >
                  <td className="py-2 px-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(transaction.id)}
                      onChange={() => toggleSelection(transaction.id)}
                      className="w-3 h-3"
                    />
                  </td>
                  <td className="py-2 px-2 text-neutral-300">{formatDate(transaction.booking_date)}</td>
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-2">
                      <div className="text-white truncate max-w-[400px]" title={transaction.description}>
                        {transaction.description || 'Brak opisu'}
                      </div>
                      {transaction.is_recurring && transaction.recurrence_pattern && (
                        <span 
                          className="text-xs px-1.5 py-0.5 bg-blue-900/30 text-blue-400 rounded"
                          title={`Płatność cykliczna: ${transaction.recurrence_pattern === 'monthly' ? 'miesięczna' : 
                                 transaction.recurrence_pattern === 'quarterly' ? 'kwartalna' :
                                 transaction.recurrence_pattern === 'yearly' ? 'roczna' :
                                 transaction.recurrence_pattern === 'weekly' ? 'tygodniowa' : 'jednorazowa'}`}
                        >
                          🔄
                        </span>
                      )}
                    </div>
                  </td>
                  <td className={`py-2 px-2 text-right font-medium ${
                    transaction.direction === 'in' ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {transaction.direction === 'in' ? '+' : ''}
                    {formatCurrency(transaction.amount, transaction.currency)}
                  </td>
                  <td className="py-2 px-2" onClick={(e) => e.stopPropagation()}>
                    {editingCategory === transaction.id ? (
                      <div className="text-xs">Zapisywanie...</div>
                    ) : (
                      <select
                        value={transaction.category || 'uncategorised'}
                        onChange={(e) => handleCategoryUpdate(transaction.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs bg-neutral-700 border border-neutral-600 rounded px-1 py-0.5 text-neutral-300"
                      >
                        <option value="uncategorised">Nieskategoryzowane</option>
                        {categories.length > 0 ? (
                          categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))
                        ) : (
                          <option disabled>Brak kategorii</option>
                        )}
                      </select>
                    )}
                  </td>
                  <td className="py-2 px-2">
                    {transaction.source_document_id && (
                      <a
                        href={`/documents/${transaction.source_document_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-blue-400 hover:text-blue-300"
                        title="Zobacz dokument"
                      >
                        📄
                      </a>
                    )}
                  </td>
                </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })()}
    </div>
  );
}

