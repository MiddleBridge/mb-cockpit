'use client';

import { useState, useEffect } from 'react';
import * as tripsDb from '../db/trips';
import * as tripItemsDb from '../db/trip-items';
import * as tripNotesDb from '../db/trip-notes';
import * as tripEvidenceDb from '../db/trip-evidence';
import type { FinanceTrip, FinanceTripItem, FinanceTripNote } from '../db/trips';
import EvidenceCell from './EvidenceCell';
import AddFromTransactionsModal from './AddFromTransactionsModal';

interface TripDetailViewProps {
  tripId: string;
  orgId: string;
  onBack: () => void;
}

export default function TripDetailView({ tripId, orgId, onBack }: TripDetailViewProps) {
  const [trip, setTrip] = useState<FinanceTrip | null>(null);
  const [items, setItems] = useState<FinanceTripItem[]>([]);
  const [notes, setNotes] = useState<FinanceTripNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingStartDate, setEditingStartDate] = useState(false);
  const [editingEndDate, setEditingEndDate] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [showAddFromTransactions, setShowAddFromTransactions] = useState(false);
  
  // Quick Add state
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddDate, setQuickAddDate] = useState('');
  const [quickAddVendor, setQuickAddVendor] = useState('');
  const [quickAddDescription, setQuickAddDescription] = useState('');
  const [quickAddAmount, setQuickAddAmount] = useState('');
  const [quickAddCurrency, setQuickAddCurrency] = useState('PLN');
  const [quickAddCategory, setQuickAddCategory] = useState('');
  const [quickAddPaidByCard, setQuickAddPaidByCard] = useState(false);

  useEffect(() => {
    loadData();
  }, [tripId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tripData, itemsData, notesData] = await Promise.all([
        tripsDb.getTripById(tripId),
        tripItemsDb.getTripItems(tripId),
        tripNotesDb.getTripNotes(tripId),
      ]);
      
      setTrip(tripData);
      setItems(itemsData);
      setNotes(notesData);
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

  const handleQuickAdd = async () => {
    if (!quickAddAmount || !trip) return;

    const item = await tripItemsDb.createTripItem({
      org_id: orgId,
      trip_id: tripId,
      source: 'manual',
      transaction_id: null,
      item_date: quickAddDate || null,
      vendor: quickAddVendor || null,
      description: quickAddDescription || null,
      category: quickAddCategory || null,
      amount: parseFloat(quickAddAmount),
      currency: quickAddCurrency,
      paid_by_company_card: quickAddPaidByCard,
      exclude_from_reimbursement: false,
    });

    if (item) {
      setShowQuickAdd(false);
      setQuickAddDate('');
      setQuickAddVendor('');
      setQuickAddDescription('');
      setQuickAddAmount('');
      setQuickAddCurrency('PLN');
      setQuickAddCategory('');
      setQuickAddPaidByCard(false);
      await loadData();
    }
  };

  const handleTogglePaidByCard = async (itemId: string, value: boolean) => {
    const updated = await tripItemsDb.updateTripItem(itemId, { paid_by_company_card: value });
    if (updated) {
      await loadData();
    }
  };

  const handleToggleExclude = async (itemId: string, value: boolean) => {
    const updated = await tripItemsDb.updateTripItem(itemId, { exclude_from_reimbursement: value });
    if (updated) {
      await loadData();
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !trip) return;

    const note = await tripNotesDb.createTripNote({
      org_id: orgId,
      trip_id: tripId,
      note: newNote.trim(),
    });

    if (note) {
      setNewNote('');
      await loadData();
    }
  };

  const handleExportCSV = async () => {
    if (!trip) return;
    
    try {
      const response = await fetch(`/api/trip-evidence/export-csv?tripId=${tripId}`);
      if (!response.ok) {
        throw new Error('Export failed');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `trip-${trip.title}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Failed to export CSV');
    }
  };

  const handleMarkSubmitted = async () => {
    if (!trip) return;
    await handleUpdateTrip({ status: 'submitted' });
  };

  // Calculate reimbursable totals
  const reimbursableTotals: Record<string, number> = {};
  const reimbursableItems: FinanceTripItem[] = [];
  
  items.forEach(item => {
    const isReimbursable = !item.paid_by_company_card && !item.exclude_from_reimbursement;
    if (isReimbursable) {
      reimbursableItems.push(item);
      const currency = item.currency || 'PLN';
      reimbursableTotals[currency] = (reimbursableTotals[currency] || 0) + Math.abs(item.amount);
    }
  });

  // Get items without evidence
  const getItemsWithoutEvidence = async () => {
    const allEvidence = await tripEvidenceDb.getTripEvidenceByTrip(tripId);
    const itemsWithEvidence = new Set(allEvidence.map(e => e.trip_item_id).filter(Boolean));
    return items.filter(item => !itemsWithEvidence.has(item.id));
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
    return new Date(dateStr).toLocaleDateString('pl-PL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  if (loading || !trip) {
    return <div className="text-center py-8 text-neutral-400">Loading trip...</div>;
  }

  return (
    <div className="space-y-4">
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
            {editingTitle ? (
              <input
                type="text"
                value={trip.title}
                onChange={(e) => handleUpdateTrip({ title: e.target.value })}
                onBlur={() => setEditingTitle(false)}
                className="text-xl font-semibold text-white bg-neutral-800 border border-neutral-700 rounded px-2 py-1"
                autoFocus
              />
            ) : (
              <h2
                className="text-xl font-semibold text-white cursor-pointer hover:text-blue-400"
                onClick={() => setEditingTitle(true)}
              >
                {trip.title}
              </h2>
            )}
            <div className="flex items-center gap-4 mt-2">
              {editingStartDate ? (
                <input
                  type="date"
                  value={trip.start_date || ''}
                  onChange={(e) => handleUpdateTrip({ start_date: e.target.value || null })}
                  onBlur={() => setEditingStartDate(false)}
                  className="text-sm text-neutral-400 bg-neutral-800 border border-neutral-700 rounded px-2 py-1"
                  autoFocus
                />
              ) : (
                <span
                  className="text-sm text-neutral-400 cursor-pointer hover:text-blue-400"
                  onClick={() => setEditingStartDate(true)}
                >
                  {formatDate(trip.start_date)} - {formatDate(trip.end_date)}
                </span>
              )}
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
            onClick={handleExportCSV}
            className="px-3 py-1.5 text-xs bg-neutral-700 text-white rounded hover:bg-neutral-600"
          >
            Export CSV
          </button>
          {trip.status === 'draft' && (
            <button
              onClick={handleMarkSubmitted}
              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Mark Submitted
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Main table */}
        <div className="col-span-12 lg:col-span-8">
          {/* Quick Add */}
          {showQuickAdd ? (
            <div className="bg-neutral-800/50 border border-neutral-700 rounded-lg p-4 mb-4">
              <div className="grid grid-cols-6 gap-2 text-xs">
                <input
                  type="date"
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

