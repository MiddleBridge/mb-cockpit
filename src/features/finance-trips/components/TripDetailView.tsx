'use client';

import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import * as tripsDb from '../db/trips';
import * as tripItemsDb from '../db/trip-items';
import * as tripEvidenceDb from '../db/trip-evidence';
import type { FinanceTrip, FinanceTripItem } from '../db/trips';
import { parseQuickAdd } from '@/lib/trips/parseQuickAdd';
import { CARD_SOURCES } from '@/lib/trips/constants';
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
  const [quickAddInput, setQuickAddInput] = useState('');
  const [quickAddError, setQuickAddError] = useState<string | null>(null);
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null);
  const [draggingOverRowId, setDraggingOverRowId] = useState<string | null>(null);
  const quickAddInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, [tripId]);

  useEffect(() => {
    // Auto-focus input on mount
    if (quickAddInputRef.current && !loading) {
      quickAddInputRef.current.focus();
    }
  }, [loading]);

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

  const handleQuickAdd = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (!quickAddInput.trim() || !trip) return;
    
    try {
      setQuickAddError(null);
      const parsed = parseQuickAdd(quickAddInput, 'PLN');
      
      if (!parsed.amount) {
        setQuickAddError('Could not parse amount. Please use format like "Hotel 120 EUR".');
        return;
      }

      const item = await tripItemsDb.createTripItem({
        org_id: orgId,
        trip_id: tripId,
        source: 'manual',
        transaction_id: null,
        item_date: parsed.date ? format(parsed.date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        vendor: parsed.vendor,
        description: parsed.description,
        category: parsed.category,
        amount: parsed.amount,
        currency: parsed.currency,
        paid_by_company_card: false,
        exclude_from_reimbursement: false,
        card_source: null,
      });

      if (item) {
        setQuickAddInput('');
        await loadData();
        quickAddInputRef.current?.focus();
      }
    } catch (error: any) {
      setQuickAddError(error.message || 'Failed to parse input');
      console.error('Error parsing quick add:', error);
    }
  };

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

      {/* Quick Add Input */}
      <form onSubmit={handleQuickAdd} className="space-y-2">
        <div className="flex gap-2">
          <input
            ref={quickAddInputRef}
            type="text"
            value={quickAddInput}
            onChange={(e) => {
              setQuickAddInput(e.target.value);
              setQuickAddError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setQuickAddInput('');
                setQuickAddError(null);
              }
            }}
            placeholder="Add expense… e.g. 'Hotel Atlantis 4200 AED'"
            className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-4 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
          />
          <button
            type="submit"
            disabled={!quickAddInput.trim()}
            className="px-4 py-2.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>
        {quickAddError && (
          <div className="text-xs text-red-400">{quickAddError}</div>
        )}
        <div className="text-xs text-neutral-500">
          Try: <button type="button" onClick={() => setQuickAddInput('Hotel Atlantis 4200 AED')} className="text-blue-400 hover:text-blue-300 underline">Hotel Atlantis 4200 AED</button> or <button type="button" onClick={() => setQuickAddInput('Uber 85 PLN')} className="text-blue-400 hover:text-blue-300 underline">Uber 85 PLN</button>
        </div>
      </form>

      {/* Expense List Table */}
      <div className="overflow-x-auto">
        {items.length === 0 ? (
          <div className="text-center py-12 bg-neutral-800/50 border border-neutral-700 rounded-lg">
            <p className="text-neutral-400 mb-4">No expenses yet. Type one above and press Enter.</p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => setQuickAddInput('Hotel Atlantis 4200 AED')}
                className="px-3 py-1.5 text-xs bg-neutral-700 text-white rounded hover:bg-neutral-600"
              >
                Hotel Atlantis 4200 AED
              </button>
              <button
                onClick={() => setQuickAddInput('Uber 85 PLN')}
                className="px-3 py-1.5 text-xs bg-neutral-700 text-white rounded hover:bg-neutral-600"
              >
                Uber 85 PLN
              </button>
            </div>
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
                <th className="text-center py-2 px-2 text-neutral-400 font-medium">Attach</th>
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
  tripId,
  orgId,
  onUpdate,
}: ExpenseRowProps) {
  const [attachmentCount, setAttachmentCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  return (
    <tr
      className="border-b border-neutral-800 hover:bg-neutral-800/50 cursor-pointer transition-colors"
      onClick={onSelect}
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
        <button
          onClick={(e) => {
            e.stopPropagation();
            fileInputRef.current?.click();
          }}
          className="text-neutral-400 hover:text-white relative"
          title="Add attachment"
        >
          📎
          {attachmentCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
              {attachmentCount}
            </span>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,.pdf"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              handleFileUpload(file);
            }
          }}
        />
      </td>
    </tr>
  );
}

