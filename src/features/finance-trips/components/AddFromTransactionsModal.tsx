'use client';

import { useState, useEffect } from 'react';
import { getTransactions, Transaction } from '@/lib/finance/queries/getTransactions';
import * as tripItemsDb from '../db/trip-items';
import type { FinanceTripItem } from '../db/trip-items';

interface AddFromTransactionsModalProps {
  orgId: string;
  tripId: string;
  onClose: () => void;
}

export default function AddFromTransactionsModal({
  orgId,
  tripId,
  onClose,
}: AddFromTransactionsModalProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    loadTransactions();
  }, [orgId, search, dateFrom, dateTo]);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      // Get used transaction IDs
      const usedIds = await tripItemsDb.getUsedTransactionIds();
      const usedSet = new Set(usedIds);

      // Get all transactions for org
      const result = await getTransactions({
        orgId,
        search: search || null,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
        direction: 'out', // Only outbound transactions can be expenses
      });

      // Filter out already used transactions
      const available = (result.transactions || []).filter(t => !usedSet.has(t.id));
      setTransactions(available);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSelection = (transactionId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(transactionId)) {
      newSelected.delete(transactionId);
    } else {
      newSelected.add(transactionId);
    }
    setSelectedIds(newSelected);
  };

  const handleAddToTrip = async () => {
    if (selectedIds.size === 0) return;

    const selectedTransactions = transactions.filter(t => selectedIds.has(t.id));
    
    for (const transaction of selectedTransactions) {
      const item: Omit<FinanceTripItem, 'id' | 'created_at'> = {
        org_id: orgId,
        trip_id: tripId,
        source: 'transaction',
        transaction_id: transaction.id,
        item_date: transaction.booking_date,
        vendor: transaction.counterparty_name || null,
        description: transaction.description || null,
        category: transaction.category || null,
        amount: transaction.amount,
        currency: transaction.currency,
        paid_by_company_card: false, // Default false, user can toggle later
        exclude_from_reimbursement: false,
        card_source: null,
      };

      await tripItemsDb.createTripItem(item);
    }

    onClose();
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: currency || 'PLN',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pl-PL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Add from Transactions</h3>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white text-xl"
          >
            ×
          </button>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-neutral-800 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search description or vendor..."
              className="text-sm bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-white"
            />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              placeholder="From date"
              className="text-sm bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-white"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              placeholder="To date"
              className="text-sm bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-white"
            />
          </div>
        </div>

        {/* Transactions List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-8 text-neutral-400">Loading transactions...</div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-neutral-400">No available transactions</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-neutral-800">
                  <th className="text-left py-2 px-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === transactions.length && transactions.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds(new Set(transactions.map(t => t.id)));
                        } else {
                          setSelectedIds(new Set());
                        }
                      }}
                      className="w-3 h-3"
                    />
                  </th>
                  <th className="text-left py-2 px-2 text-neutral-400 font-medium">Date</th>
                  <th className="text-left py-2 px-2 text-neutral-400 font-medium">Description</th>
                  <th className="text-left py-2 px-2 text-neutral-400 font-medium">Vendor</th>
                  <th className="text-right py-2 px-2 text-neutral-400 font-medium">Amount</th>
                  <th className="text-left py-2 px-2 text-neutral-400 font-medium">Category</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr
                    key={transaction.id}
                    className="border-b border-neutral-800 hover:bg-neutral-800/50 cursor-pointer"
                    onClick={() => handleToggleSelection(transaction.id)}
                  >
                    <td className="py-2 px-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(transaction.id)}
                        onChange={() => handleToggleSelection(transaction.id)}
                        className="w-3 h-3"
                      />
                    </td>
                    <td className="py-2 px-2 text-neutral-300">{formatDate(transaction.booking_date)}</td>
                    <td className="py-2 px-2 text-white">{transaction.description}</td>
                    <td className="py-2 px-2 text-neutral-300">{transaction.counterparty_name || '-'}</td>
                    <td className="py-2 px-2 text-right text-red-400 font-medium">
                      {formatCurrency(transaction.amount, transaction.currency)}
                    </td>
                    <td className="py-2 px-2 text-neutral-300">{transaction.category || 'uncategorised'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-800 flex items-center justify-between">
          <div className="text-sm text-neutral-400">
            {selectedIds.size} transaction{selectedIds.size !== 1 ? 's' : ''} selected
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-neutral-700 text-white rounded text-sm hover:bg-neutral-600"
            >
              Cancel
            </button>
            <button
              onClick={handleAddToTrip}
              disabled={selectedIds.size === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add to Trip
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

