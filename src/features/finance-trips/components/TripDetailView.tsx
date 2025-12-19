'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import * as tripsDb from '../db/trips';
import * as tripItemsDb from '../db/trip-items';
import * as tripEvidenceDb from '../db/trip-evidence';
import type { FinanceTrip, FinanceTripItem } from '../db/trips';
import { CARD_SOURCES, EXPENSE_CATEGORIES, CURRENCIES, type ExpenseCategory, type Currency, type CardSource } from '@/lib/trips/constants';
import ExpenseDrawer from './ExpenseDrawer';

interface TripDetailViewProps {
  tripId: string;
  orgId: string;
  onBack: () => void;
}

export default function TripDetailView({ tripId, orgId, onBack }: TripDetailViewProps) {
  const [trip, setTrip] = useState<FinanceTrip | null>(null);
  const [items, setItems] = useState<FinanceTripItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [quickAddCategory, setQuickAddCategory] = useState<ExpenseCategory>('OTHER');
  const [quickAddDate, setQuickAddDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [quickAddName, setQuickAddName] = useState('');
  const [quickAddAmount, setQuickAddAmount] = useState('');
  const [quickAddCurrency, setQuickAddCurrency] = useState<Currency>('PLN');
  const [quickAddCard, setQuickAddCard] = useState<CardSource>(null);
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null);
  const [draggingOverRowId, setDraggingOverRowId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [tripId]);


  const loadData = async () => {
    setLoading(true);
    try {
      const [tripData, itemsData] = await Promise.all([
        tripsDb.getTripById(tripId),
        tripItemsDb.getTripItems(tripId),
      ]);
      
      setTrip(tripData);
      setItems(itemsData);
    } catch (error) {
      console.error('Error loading trip data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTrip = async (updates: Partial<FinanceTrip>) => {
    if (!trip) return;
    
    const updated = await tripsDb.updateTrip(tripId, updates);
    if (updated) {
      setTrip(updated);
    }
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!quickAddName.trim() || !quickAddAmount || !trip) return;
    
    const amount = parseFloat(quickAddAmount);
    if (isNaN(amount) || amount <= 0) {
      return;
    }

    const item = await tripItemsDb.createTripItem({
      org_id: orgId,
      trip_id: tripId,
      source: 'manual',
      transaction_id: null,
      item_date: quickAddDate,
      vendor: quickAddName,
      description: quickAddName,
      category: quickAddCategory,
      amount: amount,
      currency: quickAddCurrency,
      paid_by_company_card: false,
      exclude_from_reimbursement: false,
      card_source: quickAddCard,
    });

    if (item) {
      // Reset form
      setQuickAddCategory('OTHER');
      setQuickAddDate(format(new Date(), 'yyyy-MM-dd'));
      setQuickAddName('');
      setQuickAddAmount('');
      setQuickAddCurrency('PLN');
      setQuickAddCard(null);
      await loadData();
    }
  };

  // Calculate summary by card
  const cardSummary = items.reduce((acc, item) => {
    if (!item.card_source) return acc;
    if (!acc[item.card_source]) {
      acc[item.card_source] = {};
    }
    if (!acc[item.card_source][item.currency]) {
      acc[item.card_source][item.currency] = 0;
    }
    acc[item.card_source][item.currency] += item.amount;
    return acc;
  }, {} as Record<string, Record<string, number>>);

  const handleCardSourceChange = async (itemId: string, cardSource: string | null) => {
    // Optimistic update
    setItems(items.map(item => 
      item.id === itemId 
        ? { ...item, card_source: cardSource as any }
        : item
    ));

    await tripItemsDb.updateTripItem(itemId, { 
      card_source: cardSource as 'MB' | 'PKO' | 'REVOLUT' | null 
    });
    await loadData();
  };

  const handleDeleteExpense = async (itemId: string) => {
    if (!confirm('Delete this expense?')) return;
    
    const success = await tripItemsDb.deleteTripItem(itemId);
    if (success) {
      await loadData();
      if (selectedExpenseId === itemId) {
        setSelectedExpenseId(null);
      }
    }
  };


  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: currency || 'PLN',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return format(new Date(dateStr), 'dd.MM.yyyy');
  };

  const formatDateRange = (start: string | null, end: string | null) => {
    if (!start && !end) return '';
    if (!start) return formatDate(end);
    if (!end) return formatDate(start);
    return `${formatDate(start)}–${formatDate(end)}`;
  };

  if (loading || !trip) {
    return <div className="text-center py-8 text-neutral-400">Loading trip...</div>;
  }

  const selectedExpense = selectedExpenseId ? items.find(i => i.id === selectedExpenseId) : null;

  return (
    <div className="space-y-4 relative">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
        <div className="flex items-center gap-4 flex-1">
          <button
            onClick={onBack}
            className="text-neutral-400 hover:text-white"
          >
            ← Back
          </button>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-white">{trip.title}</h2>
            <div className="flex items-center gap-4 mt-2">
              <span className="text-sm text-neutral-400">
                {formatDateRange(trip.start_date, trip.end_date)}
              </span>
              <select
                value={trip.status}
                onChange={(e) => handleUpdateTrip({ status: e.target.value as any })}
                className="text-xs bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-white"
              >
                <option value="draft">draft</option>
                <option value="submitted">submitted</option>
                <option value="reimbursed">reimbursed</option>
              </select>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              if (!trip) return;
              try {
                const response = await fetch(`/api/trip-evidence/export-csv?tripId=${tripId}`);
                if (!response.ok) throw new Error('Export failed');
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `trip-${trip.title}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
              } catch (error) {
                console.error('Error exporting CSV:', error);
                alert('Failed to export CSV');
              }
            }}
            className="px-3 py-1.5 text-xs bg-neutral-700 text-white rounded hover:bg-neutral-600"
          >
            Export CSV
          </button>
          {trip.status === 'draft' && items.length > 0 && (
            <button
              onClick={() => handleUpdateTrip({ status: 'submitted' })}
              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Mark Submitted
            </button>
          )}
        </div>
      </div>

      {/* Card Summary */}
      {Object.keys(cardSummary).length > 0 && (
        <div className="bg-neutral-800/50 border border-neutral-700 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Podsumowanie po kartach</h3>
          <div className="grid grid-cols-3 gap-4">
            {Object.entries(cardSummary).map(([card, amounts]) => (
              <div key={card} className="bg-neutral-900/50 rounded-lg p-3">
                <div className="text-xs font-semibold text-neutral-400 mb-2">{card}</div>
                {Object.entries(amounts).map(([currency, total]) => (
                  <div key={currency} className="flex justify-between items-center">
                    <span className="text-xs text-neutral-400">{currency}</span>
                    <span className="text-sm font-semibold text-white">{formatCurrency(total, currency)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Add Form */}
      <form onSubmit={handleQuickAdd} className="bg-neutral-800/50 border border-neutral-700 rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-6 gap-2">
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Rodzaj</label>
            <select
              value={quickAddCategory}
              onChange={(e) => setQuickAddCategory(e.target.value as ExpenseCategory)}
              className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-white"
            >
              {EXPENSE_CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Data</label>
            <input
              type="date"
              value={quickAddDate}
              onChange={(e) => setQuickAddDate(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-white"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-neutral-400 mb-1">Nazwa</label>
            <input
              type="text"
              value={quickAddName}
              onChange={(e) => setQuickAddName(e.target.value)}
              placeholder="Nazwa wydatku"
              className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-white placeholder:text-neutral-500"
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Wartość</label>
            <input
              type="number"
              step="0.01"
              value={quickAddAmount}
              onChange={(e) => setQuickAddAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-white placeholder:text-neutral-500"
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Waluta</label>
            <select
              value={quickAddCurrency}
              onChange={(e) => setQuickAddCurrency(e.target.value as Currency)}
              className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-white"
            >
              {CURRENCIES.map(currency => (
                <option key={currency.value} value={currency.value}>{currency.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="block text-xs text-neutral-400 mb-1">Karta</label>
            <select
              value={quickAddCard || ''}
              onChange={(e) => setQuickAddCard((e.target.value || null) as CardSource)}
              className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-white"
            >
              <option value="">—</option>
              {CARD_SOURCES.map(card => (
                <option key={card.value} value={card.value}>{card.label}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={!quickAddName.trim() || !quickAddAmount}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Dodaj
          </button>
        </div>
      </form>

      {/* Expense List Table */}
      <div className="overflow-x-auto">
        {items.length === 0 ? (
          <div className="text-center py-12 bg-neutral-800/50 border border-neutral-700 rounded-lg">
            <p className="text-neutral-400">Brak wydatków. Dodaj pierwszy wydatek używając formularza powyżej.</p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-neutral-800">
                <th className="text-left py-2 px-2 text-neutral-400 font-medium">Date</th>
                <th className="text-left py-2 px-2 text-neutral-400 font-medium">Vendor / Description</th>
                <th className="text-right py-2 px-2 text-neutral-400 font-medium">Amount</th>
                <th className="text-left py-2 px-2 text-neutral-400 font-medium">Category</th>
                <th className="text-left py-2 px-2 text-neutral-400 font-medium">Card</th>
                <th className="text-center py-2 px-2 text-neutral-400 font-medium w-16">Akcje</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <ExpenseRow
                  key={item.id}
                  item={item}
                  formatDate={formatDate}
                  formatCurrency={formatCurrency}
                  onSelect={() => setSelectedExpenseId(item.id)}
                  onCardSourceChange={(cardSource) => handleCardSourceChange(item.id, cardSource)}
                  onDelete={() => handleDeleteExpense(item.id)}
                  tripId={tripId}
                  orgId={orgId}
                  onUpdate={loadData}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Expense Detail Drawer */}
      {selectedExpense && (
        <ExpenseDrawer
          expense={selectedExpense}
          tripId={tripId}
          orgId={orgId}
          onClose={() => setSelectedExpenseId(null)}
          onUpdate={loadData}
          onDelete={handleDeleteExpense}
        />
      )}
    </div>
  );
}

// Expense Row Component
interface ExpenseRowProps {
  item: FinanceTripItem;
  formatDate: (date: string | null) => string;
  formatCurrency: (amount: number, currency: string) => string;
  onSelect: () => void;
  onCardSourceChange: (cardSource: string | null) => void;
  onDelete: () => void;
  tripId: string;
  orgId: string;
  onUpdate: () => void;
}

function ExpenseRow({
  item,
  formatDate,
  formatCurrency,
  onSelect,
  onCardSourceChange,
  onDelete,
  tripId,
  orgId,
  onUpdate,
}: ExpenseRowProps) {
  const [attachmentCount, setAttachmentCount] = useState(0);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  useEffect(() => {
    tripEvidenceDb.getTripEvidenceByItem(item.id).then(evidence => {
      setAttachmentCount(evidence.length);
    });
  }, [item.id]);

  const handleFileUpload = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('tripId', tripId);
      formData.append('tripItemId', item.id);
      formData.append('orgId', orgId);

      const response = await fetch('/api/trip-evidence/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        onUpdate();
      }
    } catch (error) {
      console.error('Error uploading file:', error);
    }
  };

  // Handle paste from clipboard (Ctrl+V) - works globally when this row was recently clicked
  const rowRef = useRef<HTMLTableRowElement>(null);
  const isActiveRowRef = useRef(false);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!isActiveRowRef.current) return;
      
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const clipboardItem = items[i];
        if (clipboardItem.type.indexOf('image') !== -1) {
          const file = clipboardItem.getAsFile();
          if (file) {
            e.preventDefault();
            handleFileUpload(file);
          }
        }
      }
    };

    const handleClick = () => {
      isActiveRowRef.current = true;
      setTimeout(() => { isActiveRowRef.current = false; }, 5000); // 5s window for paste
    };

    const row = rowRef.current;
    if (row) {
      row.addEventListener('click', handleClick);
      window.addEventListener('paste', handlePaste);
      return () => {
        row.removeEventListener('click', handleClick);
        window.removeEventListener('paste', handlePaste);
      };
    }
  }, [item.id]);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  return (
    <tr
      ref={rowRef}
      className={`border-b border-neutral-800 hover:bg-neutral-800/50 cursor-pointer transition-colors ${
        isDraggingOver ? 'bg-blue-900/30 border-blue-500' : ''
      }`}
      onClick={onSelect}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      title="Kliknij aby edytować, przeciągnij plik aby dodać załącznik, kliknij i Ctrl+V aby wkleić z schowka"
    >
      <td className="py-2 px-2 text-neutral-300">{formatDate(item.item_date)}</td>
      <td className="py-2 px-2">
        <div className="font-medium text-white">{item.vendor || item.description || '-'}</div>
        {item.description && item.vendor && (
          <div className="text-xs text-neutral-500 mt-0.5">{item.description}</div>
        )}
      </td>
      <td className="py-2 px-2 text-right">
        <div className={`font-medium ${item.amount < 0 ? 'text-red-400' : 'text-green-400'}`}>
          {formatCurrency(item.amount, item.currency)}
        </div>
      </td>
      <td className="py-2 px-2">
        {item.category && (
          <span className="inline-block px-2 py-0.5 bg-neutral-700 text-neutral-300 rounded text-xs">
            {item.category}
          </span>
        )}
      </td>
      <td className="py-2 px-2" onClick={(e) => e.stopPropagation()}>
        <select
          value={item.card_source || ''}
          onChange={(e) => onCardSourceChange(e.target.value || null)}
          className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          onClick={(e) => e.stopPropagation()}
        >
          <option value="">—</option>
          {CARD_SOURCES.map(card => (
            <option key={card.value} value={card.value}>{card.label}</option>
          ))}
        </select>
      </td>
      <td className="py-2 px-2 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-center gap-2">
          {attachmentCount > 0 && (
            <span className="text-xs text-neutral-400" title={`${attachmentCount} załącznik(ów)`}>
              📎 {attachmentCount}
            </span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="text-red-400 hover:text-red-300 text-xs"
            title="Usuń wydatek"
          >
            ✕
          </button>
        </div>
      </td>
    </tr>
  );
}

