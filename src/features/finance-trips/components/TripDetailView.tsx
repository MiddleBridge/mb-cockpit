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

                  value={quickAddDate}
                  onChange={(e) => setQuickAddDate(e.target.value)}
                  placeholder="Date"
                  className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-white"
                />
                <input
                  type="text"
                  value={quickAddVendor}
                  onChange={(e) => setQuickAddVendor(e.target.value)}
                  placeholder="Vendor"
                  className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-white"
                />
                <input
                  type="text"
                  value={quickAddDescription}
                  onChange={(e) => setQuickAddDescription(e.target.value)}
                  placeholder="Description"
                  className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-white"
                />
                <div className="flex gap-1">
                  <input
                    type="number"
                    step="0.01"
                    value={quickAddAmount}
                    onChange={(e) => setQuickAddAmount(e.target.value)}
                    placeholder="Amount"
                    className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-white"
                  />
                  <select
                    value={quickAddCurrency}
                    onChange={(e) => setQuickAddCurrency(e.target.value)}
                    className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-white"
                  >
                    <option value="PLN">PLN</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
                <input
                  type="text"
                  value={quickAddCategory}
                  onChange={(e) => setQuickAddCategory(e.target.value)}
                  placeholder="Category"
                  className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-white"
                />
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1 text-neutral-300">
                    <input
                      type="checkbox"
                      checked={quickAddPaidByCard}
                      onChange={(e) => setQuickAddPaidByCard(e.target.checked)}
                      className="w-3 h-3"
                    />
                    <span className="text-xs">Paid by card</span>
                  </label>
                  <button
                    onClick={handleQuickAdd}
                    className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setShowQuickAdd(false);
                      setQuickAddDate('');
                      setQuickAddVendor('');
                      setQuickAddDescription('');
                      setQuickAddAmount('');
                      setQuickAddCurrency('PLN');
                      setQuickAddCategory('');
                      setQuickAddPaidByCard(false);
                    }}
                    className="px-2 py-1 bg-neutral-700 text-white rounded text-xs hover:bg-neutral-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setShowQuickAdd(true)}
                className="px-3 py-1.5 text-xs bg-neutral-700 text-white rounded hover:bg-neutral-600"
              >
                Quick Add
              </button>
              <button
                onClick={() => setShowAddFromTransactions(true)}
                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Add from Transactions
              </button>
            </div>
          )}

          {/* Items Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-neutral-800">
                  <th className="text-left py-2 px-2 text-neutral-400 font-medium">Date</th>
                  <th className="text-left py-2 px-2 text-neutral-400 font-medium">Vendor/Description</th>
                  <th className="text-right py-2 px-2 text-neutral-400 font-medium">Amount</th>
                  <th className="text-left py-2 px-2 text-neutral-400 font-medium">Category</th>
                  <th className="text-center py-2 px-2 text-neutral-400 font-medium">Paid by card</th>
                  <th className="text-center py-2 px-2 text-neutral-400 font-medium">Exclude</th>
                  <th className="text-left py-2 px-2 text-neutral-400 font-medium">Evidence</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-neutral-500">
                      No items yet. Use "Quick Add" or "Add from Transactions" to add costs.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const isReimbursable = !item.paid_by_company_card && !item.exclude_from_reimbursement;
                    return (
                      <tr key={item.id} data-item-id={item.id} className="border-b border-neutral-800 hover:bg-neutral-800/50">
                        <td className="py-2 px-2 text-neutral-300">{formatDate(item.item_date)}</td>
                        <td className="py-2 px-2">
                          <div className="text-white">{item.vendor || item.description || '-'}</div>
                          {item.description && item.vendor && (
                            <div className="text-xs text-neutral-500">{item.description}</div>
                          )}
                        </td>
                        <td className="py-2 px-2 text-right">
                          <div className={`font-medium ${item.amount < 0 ? 'text-red-400' : 'text-green-400'}`}>
                            {formatCurrency(item.amount, item.currency)}
                          </div>
                          {isReimbursable && (
                            <div className="text-xs text-blue-400">To reimburse</div>
                          )}
                        </td>
                        <td className="py-2 px-2 text-neutral-300">{item.category || '-'}</td>
                        <td className="py-2 px-2 text-center">
                          <input
                            type="checkbox"
                            checked={item.paid_by_company_card}
                            onChange={(e) => handleTogglePaidByCard(item.id, e.target.checked)}
                            className="w-4 h-4"
                          />
                        </td>
                        <td className="py-2 px-2 text-center">
                          <input
                            type="checkbox"
                            checked={item.exclude_from_reimbursement}
                            onChange={(e) => handleToggleExclude(item.id, e.target.checked)}
                            className="w-4 h-4"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <EvidenceCell
                            tripItemId={item.id}
                            tripId={tripId}
                            orgId={orgId}
                            onUpdate={loadData}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Side Panel */}
        <div className="col-span-12 lg:col-span-4 space-y-4">
          {/* Reimbursement Summary */}
          <div className="bg-neutral-800/50 border border-neutral-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Reimbursement Summary</h3>
            {Object.keys(reimbursableTotals).length === 0 ? (
              <p className="text-xs text-neutral-500">No reimbursable items</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(reimbursableTotals).map(([currency, total]) => (
                  <div key={currency} className="flex items-center justify-between">
                    <span className="text-xs text-neutral-400">{currency}</span>
                    <span className="text-lg font-semibold text-blue-400">
                      {formatCurrency(total, currency)}
                    </span>
                  </div>
                ))}
                <div className="mt-3 pt-3 border-t border-neutral-700">
                  <div className="text-xs text-neutral-400 mb-1">Reimbursable items:</div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {reimbursableItems.map((item) => (
                      <div
                        key={item.id}
                        className="text-xs bg-neutral-900/50 rounded px-2 py-1 cursor-pointer hover:bg-neutral-900"
                        onClick={() => {
                          const row = document.querySelector(`tr[data-item-id="${item.id}"]`);
                          row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }}
                      >
                        <div className="text-white truncate">{item.vendor || item.description || 'No description'}</div>
                        <div className="text-neutral-500">{formatCurrency(item.amount, item.currency)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Missing Evidence */}
          <div className="bg-neutral-800/50 border border-neutral-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Missing Evidence</h3>
            <MissingEvidenceList 
              tripId={tripId} 
              items={items} 
              formatDate={formatDate}
              formatCurrency={formatCurrency}
            />
          </div>

          {/* Notes */}
          <div className="bg-neutral-800/50 border border-neutral-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Notes</h3>
            <div className="space-y-2">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a note..."
                rows={3}
                className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs text-white placeholder:text-neutral-500 resize-none"
              />
              <button
                onClick={handleAddNote}
                disabled={!newNote.trim()}
                className="w-full px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Note
              </button>
              <div className="space-y-2 mt-3 max-h-48 overflow-y-auto">
                {notes.map((note) => (
                  <div key={note.id} className="bg-neutral-900/50 rounded p-2">
                    <p className="text-xs text-white whitespace-pre-wrap">{note.note}</p>
                    <p className="text-[10px] text-neutral-500 mt-1">
                      {formatDate(note.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add from Transactions Modal */}
      {showAddFromTransactions && (
        <AddFromTransactionsModal
          orgId={orgId}
          tripId={tripId}
          onClose={() => {
            setShowAddFromTransactions(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}

// Helper component for missing evidence list
function MissingEvidenceList({ 
  tripId, 
  items,
  formatDate,
  formatCurrency,
}: { 
  tripId: string; 
  items: FinanceTripItem[];
  formatDate: (dateStr: string | null) => string;
  formatCurrency: (amount: number, currency: string) => string;
}) {
  const [itemsWithoutEvidence, setItemsWithoutEvidence] = useState<FinanceTripItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMissingEvidence();
  }, [tripId, items]);

  const loadMissingEvidence = async () => {
    setLoading(true);
    try {
      const allEvidence = await tripEvidenceDb.getTripEvidenceByTrip(tripId);
      const itemsWithEvidence = new Set(allEvidence.map(e => e.trip_item_id).filter(Boolean));
      const missing = items.filter(item => !itemsWithEvidence.has(item.id));
      setItemsWithoutEvidence(missing);
    } catch (error) {
      console.error('Error loading missing evidence:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <p className="text-xs text-neutral-500">Loading...</p>;
  }

  if (itemsWithoutEvidence.length === 0) {
    return <p className="text-xs text-neutral-500">All items have evidence</p>;
  }

  return (
    <div className="space-y-1 max-h-32 overflow-y-auto">
      {itemsWithoutEvidence.map((item) => (
        <div
          key={item.id}
          className="text-xs bg-neutral-900/50 rounded px-2 py-1 cursor-pointer hover:bg-neutral-900"
          onClick={() => {
            const row = document.querySelector(`tr[data-item-id="${item.id}"]`);
            row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
        >
          <div className="text-white truncate">{item.vendor || item.description || 'No description'}</div>
          <div className="text-neutral-500">{formatCurrency(item.amount, item.currency)}</div>
        </div>
      ))}
    </div>
  );
}

