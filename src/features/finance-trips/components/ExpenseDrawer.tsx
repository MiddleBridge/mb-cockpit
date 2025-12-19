'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import * as tripItemsDb from '../db/trip-items';
import * as tripEvidenceDb from '../db/trip-evidence';
import type { FinanceTripItem, FinanceTripEvidence } from '../db/trips';
import { CARD_SOURCES, type CardSource } from '@/lib/trips/constants';
import EvidenceUploader from './EvidenceUploader';

interface ExpenseDrawerProps {
  expense: FinanceTripItem;
  tripId: string;
  orgId: string;
  onClose: () => void;
  onUpdate: () => void;
  onDelete: (expenseId: string) => void;
}

export default function ExpenseDrawer({
  expense,
  tripId,
  orgId,
  onUpdate,
  onClose,
  onDelete,
}: ExpenseDrawerProps) {
  const [itemDate, setItemDate] = useState(expense.item_date || '');
  const [vendor, setVendor] = useState(expense.vendor || '');
  const [description, setDescription] = useState(expense.description || '');
  const [amount, setAmount] = useState(expense.amount.toString());
  const [currency, setCurrency] = useState(expense.currency);
  const [category, setCategory] = useState(expense.category || '');
  const [cardSource, setCardSource] = useState(expense.card_source || '');
  const [paidByCard, setPaidByCard] = useState(expense.paid_by_company_card);
  const [evidence, setEvidence] = useState<FinanceTripEvidence[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadEvidence();
  }, [expense.id]);

  const loadEvidence = async () => {
    const data = await tripEvidenceDb.getTripEvidenceByItem(expense.id);
    setEvidence(data);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await tripItemsDb.updateTripItem(expense.id, {
        item_date: itemDate || null,
        vendor: vendor || null,
        description: description || null,
        amount: parseFloat(amount),
        currency,
        category: category || null,
        card_source: (cardSource === '' ? null : cardSource) as CardSource,
        paid_by_company_card: paidByCard,
      });
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error updating expense:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteEvidence = async (evidenceId: string) => {
    if (!confirm('Delete this attachment?')) return;
    
    const success = await tripEvidenceDb.deleteTripEvidence(evidenceId);
    if (success) {
      await loadEvidence();
      onUpdate();
    }
  };

  const handlePreviewEvidence = async (ev: FinanceTripEvidence) => {
    try {
      const response = await fetch(`/api/trip-evidence/signed-url?path=${encodeURIComponent(ev.storage_path)}`);
      if (response.ok) {
        const data = await response.json();
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Error getting signed URL:', error);
    }
  };

  // Parse EU date format (DD.MM.YYYY) to YYYY-MM-DD for input
  const parseEUDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const match = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    if (match) {
      return `${match[3]}-${match[2]}-${match[1]}`;
    }
    return dateStr;
  };

  // Format date for display (YYYY-MM-DD to DD.MM.YYYY)
  const formatEUDateInput = (dateStr: string): string => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return format(date, 'dd.MM.yyyy');
    } catch {
      return dateStr;
    }
  };

  const formattedDate = itemDate ? formatEUDateInput(itemDate) : '';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-neutral-900 border-l border-neutral-800 z-50 overflow-y-auto shadow-xl">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
            <h3 className="text-lg font-semibold text-white">Edit Expense</h3>
            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-white text-xl"
            >
              ×
            </button>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            {/* Date */}
            <div>
              <label className="block text-sm text-neutral-400 mb-1.5">Date</label>
              <input
                type="date"
                value={itemDate}
                onChange={(e) => setItemDate(e.target.value)}
                className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-white"
              />
              {formattedDate && (
                <div className="text-xs text-neutral-500 mt-1">Formatted: {formattedDate}</div>
              )}
            </div>

            {/* Vendor */}
            <div>
              <label className="block text-sm text-neutral-400 mb-1.5">Vendor</label>
              <input
                type="text"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-white"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm text-neutral-400 mb-1.5">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-white resize-none"
              />
            </div>

            {/* Amount and Currency */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="block text-sm text-neutral-400 mb-1.5">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-neutral-400 mb-1.5">Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-white"
                >
                  <option value="PLN">PLN</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="AED">AED</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm text-neutral-400 mb-1.5">Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. HOTEL, FLIGHT, FOOD, TRANSPORT, OTHER"
                className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-white"
              />
            </div>

            {/* Card Source */}
            <div>
              <label className="block text-sm text-neutral-400 mb-1.5">Card</label>
              <select
                value={cardSource}
                onChange={(e) => setCardSource(e.target.value)}
                className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-white"
              >
                <option value="">—</option>
                {CARD_SOURCES.map(card => (
                  <option key={card.value} value={card.value}>{card.label}</option>
                ))}
              </select>
              <div className="text-xs text-neutral-500 mt-1">Source card used for payment</div>
            </div>

            {/* Paid by Company Card */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={paidByCard}
                  onChange={(e) => setPaidByCard(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm text-neutral-300">Paid by company card</span>
              </label>
            </div>

            {/* Attachments */}
            <div>
              <label className="block text-sm text-neutral-400 mb-1.5">Attachments</label>
              <EvidenceUploader
                tripId={tripId}
                tripItemId={expense.id}
                orgId={orgId}
                onUploadSuccess={() => {
                  loadEvidence();
                  onUpdate();
                }}
              />
              
              {evidence.length > 0 && (
                <div className="mt-3 space-y-2">
                  {evidence.map((ev) => (
                    <div
                      key={ev.id}
                      className="flex items-center justify-between bg-neutral-800/50 rounded p-2"
                    >
                      <button
                        onClick={() => handlePreviewEvidence(ev)}
                        className="text-sm text-white hover:text-blue-400 truncate flex-1 text-left"
                      >
                        {ev.file_name}
                      </button>
                      <button
                        onClick={() => handleDeleteEvidence(ev.id)}
                        className="ml-2 text-xs text-red-400 hover:text-red-300"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t border-neutral-800">
            <button
              onClick={() => onDelete(expense.id)}
              className="px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700"
            >
              Delete Expense
            </button>
            <div className="flex-1" />
            <button
              onClick={onClose}
              className="px-4 py-2 bg-neutral-700 text-white rounded text-sm hover:bg-neutral-600"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !amount}
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

