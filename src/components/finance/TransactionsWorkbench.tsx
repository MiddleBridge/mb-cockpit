'use client';

import { useState, useEffect, useCallback } from 'react';
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
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  }, [orgId, filters.tab, filters.dateFrom, filters.dateTo, filters.search, filters.category, filters.direction]);

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
        // Optimistic update
        setTransactions(prev => prev.map(t => 
          t.id === transactionId ? { ...t, category } : t
        ));
      }
    } catch (error) {
      console.error('Error updating category:', error);
    } finally {
      setEditingCategory(null);
    }
  };

  const handleBulkCategoryUpdate = async (category: string) => {
    for (const id of selectedIds) {
      await handleCategoryUpdate(id, category);
    }
    onSelectionChange([]);
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

  // Get needs review count
  const needsReviewCount = transactions.filter(t => 
    !t.counterparty_name || t.counterparty_name === ''
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
      ) : (
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
                <th className="text-left py-2 px-2 text-neutral-400 font-medium">Kontrahent</th>
                <th className="text-right py-2 px-2 text-neutral-400 font-medium">Kwota</th>
                <th className="text-left py-2 px-2 text-neutral-400 font-medium">Kategoria</th>
                <th className="text-left py-2 px-2 text-neutral-400 font-medium">Dokument</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => (
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
                    <div className="text-white truncate max-w-[300px]" title={transaction.description}>
                      {transaction.description || 'Brak opisu'}
                    </div>
                  </td>
                  <td className="py-2 px-2 text-neutral-400">
                    {transaction.counterparty_name || '-'}
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
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

