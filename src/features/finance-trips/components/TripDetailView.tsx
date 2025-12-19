'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import * as tripsDb from '../db/trips';
import * as tripItemsDb from '../db/trip-items';
import * as tripEvidenceDb from '../db/trip-evidence';
import type { FinanceTrip, FinanceTripItem, FinanceTripEvidence } from '../db/trips';
import { CARD_SOURCES, EXPENSE_CATEGORIES, CURRENCIES, type ExpenseCategory, type Currency, type CardSource } from '@/lib/trips/constants';

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
          <button
            onClick={async () => {
              if (!trip || items.length === 0) return;
              try {
                // Get all evidence for all items
                const allEvidence = await Promise.all(
                  items.map(async (item) => {
                    const evidence = await tripEvidenceDb.getTripEvidenceByItem(item.id);
                    return evidence.map(ev => ({ ...ev, expense: item }));
                  })
                );
                const flatEvidence = allEvidence.flat();

                if (flatEvidence.length === 0) {
                  alert('Brak załączników do pobrania');
                  return;
                }

                // Download each file with custom name
                for (const ev of flatEvidence) {
                  const expense = ev.expense;
                  const dateStr = expense.item_date ? format(new Date(expense.item_date), 'dd.MM.yyyy') : 'brak-daty';
                  const nameStr = (expense.vendor || expense.description || 'brak-nazwy').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
                  const amountStr = expense.amount.toString().replace('.', ',');
                  const currencyStr = expense.currency || 'PLN';
                  
                  const customFileName = `${dateStr} | ${nameStr} | ${amountStr} | ${currencyStr}.${ev.file_name.split('.').pop() || 'pdf'}`;

                  try {
                    const urlResponse = await fetch(`/api/trip-evidence/signed-url?path=${encodeURIComponent(ev.storage_path)}`);
                    if (!urlResponse.ok) continue;
                    
                    const { url } = await urlResponse.json();
                    const fileResponse = await fetch(url);
                    if (!fileResponse.ok) continue;
                    
                    const blob = await fileResponse.blob();
                    const downloadUrl = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = downloadUrl;
                    a.download = customFileName;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(downloadUrl);
                    document.body.removeChild(a);
                    
                    // Small delay between downloads to avoid browser blocking
                    await new Promise(resolve => setTimeout(resolve, 200));
                  } catch (err) {
                    console.error(`Error downloading ${ev.file_name}:`, err);
                  }
                }
              } catch (error) {
                console.error('Error downloading files:', error);
                alert('Błąd podczas pobierania plików');
              }
            }}
            className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
            disabled={items.length === 0}
          >
            Pobierz załączniki
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
            <tbody
              onDragOver={(e) => {
                // Allow drop on tbody
                const hasFiles = Array.from(e.dataTransfer.types).some(type => 
                  type === 'Files' || type.startsWith('application/') || type.startsWith('image/')
                );
                if (hasFiles) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'copy';
                }
              }}
              onDrop={(e) => {
                // Prevent default drop on tbody (let rows handle it)
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              {items.map((item) => (
                <ExpenseRow
                  key={item.id}
                  item={item}
                  formatDate={formatDate}
                  formatCurrency={formatCurrency}
                  onCardSourceChange={(cardSource) => handleCardSourceChange(item.id, cardSource)}
                  onDelete={() => handleDeleteExpense(item.id)}
                  tripId={tripId}
                  orgId={orgId}
                  onUpdate={async (updates) => {
                    await tripItemsDb.updateTripItem(item.id, updates);
                    await loadData();
                  }}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}

// Expense Row Component
interface ExpenseRowProps {
  item: FinanceTripItem;
  formatDate: (date: string | null) => string;
  formatCurrency: (amount: number, currency: string) => string;
  onCardSourceChange: (cardSource: string | null) => void;
  onUpdate: (updates: Partial<FinanceTripItem>) => Promise<void>;
  onDelete: () => void;
  tripId: string;
  orgId: string;
}

function ExpenseRow({
  item,
  formatDate,
  formatCurrency,
  onCardSourceChange,
  onUpdate,
  onDelete,
  tripId,
  orgId,
}: ExpenseRowProps) {
  const [attachmentCount, setAttachmentCount] = useState(0);
  const [evidence, setEvidence] = useState<FinanceTripEvidence[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [showAttachmentsModal, setShowAttachmentsModal] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const rowRef = useRef<HTMLTableRowElement>(null);
  const dragCounterRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const attachmentsBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadEvidence();
  }, [item.id]);

  const loadEvidence = async () => {
    const data = await tripEvidenceDb.getTripEvidenceByItem(item.id);
    setEvidence(data);
    setAttachmentCount(data.length);
  };

  useEffect(() => {
    if (editingField && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingField]);

  const handleFieldClick = (field: string, currentValue: string) => {
    setEditingField(field);
    setEditValue(currentValue);
  };

  const handleFieldSave = async () => {
    if (!editingField) return;
    
    const updates: Partial<FinanceTripItem> = {};
    
    if (editingField === 'date') {
      updates.item_date = editValue || null;
    } else if (editingField === 'vendor') {
      updates.vendor = editValue || null;
    } else if (editingField === 'description') {
      updates.description = editValue || null;
    } else if (editingField === 'amount') {
      const numValue = parseFloat(editValue.replace(',', '.'));
      if (!isNaN(numValue)) {
        updates.amount = numValue;
      }
    } else if (editingField === 'currency') {
      updates.currency = editValue;
    } else if (editingField === 'category') {
      updates.category = editValue || null;
    }
    
    await onUpdate(updates);
    setEditingField(null);
    setEditValue('');
  };

  const handleFieldCancel = () => {
    setEditingField(null);
    setEditValue('');
  };

  const handleFileUpload = useCallback(async (file: File) => {
    try {
      console.log('📤 Uploading file:', file.name, file.size, file.type);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('tripId', tripId);
      formData.append('tripItemId', item.id);
      formData.append('orgId', orgId);

      const response = await fetch('/api/trip-evidence/upload', {
        method: 'POST',
        body: formData,
      });

      const responseData = await response.json();
      console.log('📥 Upload response:', response.status, responseData);

      if (!response.ok) {
        const errorMsg = responseData.error || 'Upload failed';
        console.error('❌ Upload error:', errorMsg);
        alert(`Błąd podczas wgrywania pliku: ${errorMsg}`);
        return;
      }

      // Refresh evidence list
      await loadEvidence();
      
      // Also trigger parent update
      await onUpdate({});
      
      console.log('✅ Upload successful');
    } catch (error: any) {
      console.error('❌ Error uploading file:', error);
      alert(`Błąd podczas wgrywania pliku: ${error.message || 'Nieznany błąd'}`);
    }
  }, [tripId, item.id, orgId, onUpdate]);

  // Handle paste from clipboard (Ctrl+V) - works globally, uploads to this expense
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const clipboardItem = items[i];
        // Support both images and PDFs from clipboard
        if (clipboardItem.type.indexOf('image') !== -1 || clipboardItem.type.indexOf('application/pdf') !== -1) {
          const file = clipboardItem.getAsFile();
          if (file) {
            e.preventDefault();
            handleFileUpload(file);
            break; // Only handle first file
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [handleFileUpload]);

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    dragCounterRef.current++;
    
    // Always allow drag if there are any types (simplified - accept all drags)
    if (e.dataTransfer.types && e.dataTransfer.types.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(true);
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    dragCounterRef.current--;
    
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDraggingOver(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    // Always allow drop if there are any types
    if (e.dataTransfer.types && e.dataTransfer.types.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
      setIsDraggingOver(true);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    dragCounterRef.current = 0;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      console.log('Dropping file:', file.name, file.type, file.size);
      handleFileUpload(file);
    } else {
      console.log('No files in drop event');
    }
  };

  return (
    <tr
      ref={rowRef}
      className="border-b border-neutral-800 hover:bg-neutral-800/50 transition-colors"
    >
      {/* Date */}
      <td className="py-2 px-2" onClick={() => handleFieldClick('date', item.item_date || '')}>
        {editingField === 'date' ? (
          <input
            ref={inputRef}
            type="date"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleFieldSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleFieldSave();
              if (e.key === 'Escape') handleFieldCancel();
            }}
            className="w-full bg-neutral-800 border border-blue-500 rounded px-1 py-0.5 text-xs text-white"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="text-neutral-300 cursor-pointer hover:text-white">{formatDate(item.item_date)}</span>
        )}
      </td>

      {/* Vendor/Description */}
      <td className="py-2 px-2" onClick={() => handleFieldClick('vendor', item.vendor || '')}>
        {editingField === 'vendor' ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleFieldSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleFieldSave();
              if (e.key === 'Escape') handleFieldCancel();
            }}
            className="w-full bg-neutral-800 border border-blue-500 rounded px-1 py-0.5 text-xs text-white"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div className="font-medium text-white cursor-pointer hover:text-blue-400">
            {item.vendor || item.description || '-'}
          </div>
        )}
      </td>

      {/* Amount */}
      <td className="py-2 px-2 text-right" onClick={() => handleFieldClick('amount', item.amount.toString())}>
        {editingField === 'amount' ? (
          <input
            ref={inputRef}
            type="number"
            step="0.01"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleFieldSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleFieldSave();
              if (e.key === 'Escape') handleFieldCancel();
            }}
            className="w-full bg-neutral-800 border border-blue-500 rounded px-1 py-0.5 text-xs text-white text-right"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div className={`font-medium cursor-pointer hover:text-blue-400 ${item.amount < 0 ? 'text-red-400' : 'text-green-400'}`}>
            {formatCurrency(item.amount, item.currency)}
          </div>
        )}
      </td>

      {/* Category */}
      <td className="py-2 px-2" onClick={() => handleFieldClick('category', item.category || '')}>
        {editingField === 'category' ? (
          <select
            ref={inputRef as any}
            value={editValue}
            onChange={(e) => {
              setEditValue(e.target.value);
              setTimeout(() => handleFieldSave(), 100);
            }}
            className="w-full bg-neutral-800 border border-blue-500 rounded px-1 py-0.5 text-xs text-white"
            onClick={(e) => e.stopPropagation()}
            onBlur={handleFieldSave}
          >
            <option value="">—</option>
            {EXPENSE_CATEGORIES.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
        ) : (
          <span 
            className="inline-block px-2 py-0.5 bg-neutral-700 text-neutral-300 rounded text-xs cursor-pointer hover:bg-neutral-600"
            title={item.category || 'Kliknij aby zmienić'}
          >
            {item.category || '—'}
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
      {/* Attachments - Drag & Drop Box */}
      <td className="py-2 px-2 text-center relative" onClick={(e) => e.stopPropagation()}>
        <div
          className={`
            w-8 h-8 rounded border-2 border-dashed flex items-center justify-center cursor-pointer transition-all mx-auto
            ${isDraggingOver 
              ? 'border-blue-500 bg-blue-500/20 border-solid' 
              : 'border-neutral-600 hover:border-neutral-400 hover:bg-neutral-800/50'
            }
          `}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          title={attachmentCount > 0 ? "Kliknij aby zobaczyć załączniki" : "Kliknij aby dodać plik lub przeciągnij tutaj"}
          onClick={(e) => {
            e.stopPropagation();
            if (attachmentCount > 0) {
              setShowAttachmentsModal(true);
            } else {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = 'image/*,application/pdf';
              input.onchange = (ev) => {
                const file = (ev.target as HTMLInputElement).files?.[0];
                if (file) handleFileUpload(file);
              };
              input.click();
            }
          }}
        >
          {attachmentCount > 0 ? (
            <span className="text-xs text-blue-400 font-semibold">{attachmentCount}</span>
          ) : (
            <span className="text-xs text-neutral-400">📎</span>
          )}
        </div>

        {/* Attachments Modal */}
        {showAttachmentsModal && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowAttachmentsModal(false)}
            />
            {/* Modal */}
            <div
              className="absolute right-0 top-full mt-2 z-50 w-96 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl p-4 max-h-96 overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white">Załączniki ({evidence.length})</h3>
                <button
                  onClick={() => setShowAttachmentsModal(false)}
                  className="text-neutral-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              {/* Add new file button */}
              <button
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*,application/pdf';
                  input.onchange = async (ev) => {
                    const file = (ev.target as HTMLInputElement).files?.[0];
                    if (file) {
                      await handleFileUpload(file);
                      await loadEvidence();
                    }
                  };
                  input.click();
                }}
                className="w-full mb-3 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded"
              >
                + Dodaj plik
              </button>

              {/* Evidence list */}
              <div className="space-y-2">
                {evidence.map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-center justify-between p-2 bg-neutral-800 rounded border border-neutral-700"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-white truncate">{ev.file_name}</div>
                      <div className="text-xs text-neutral-400">
                        {ev.file_size ? `${(ev.file_size / 1024).toFixed(1)} KB` : 'Unknown size'}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={async () => {
                          try {
                            const response = await fetch(`/api/trip-evidence/signed-url?path=${encodeURIComponent(ev.storage_path)}`);
                            if (!response.ok) throw new Error('Failed to get URL');
                            const { url } = await response.json();
                            window.open(url, '_blank');
                          } catch (error) {
                            console.error('Error opening file:', error);
                            alert('Błąd podczas otwierania pliku');
                          }
                        }}
                        className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded"
                        title="Otwórz podgląd"
                      >
                        👁
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            const response = await fetch(`/api/trip-evidence/signed-url?path=${encodeURIComponent(ev.storage_path)}`);
                            if (!response.ok) throw new Error('Failed to get URL');
                            const { url } = await response.json();
                            const fileResponse = await fetch(url);
                            if (!fileResponse.ok) throw new Error('Failed to download');
                            const blob = await fileResponse.blob();
                            const downloadUrl = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = downloadUrl;
                            a.download = ev.file_name;
                            document.body.appendChild(a);
                            a.click();
                            window.URL.revokeObjectURL(downloadUrl);
                            document.body.removeChild(a);
                          } catch (error) {
                            console.error('Error downloading file:', error);
                            alert('Błąd podczas pobierania pliku');
                          }
                        }}
                        className="px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded"
                        title="Pobierz"
                      >
                        ⬇
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm('Czy na pewno chcesz usunąć ten załącznik?')) return;
                          try {
                            const success = await tripEvidenceDb.deleteTripEvidence(ev.id);
                            if (success) {
                              await loadEvidence();
                              await onUpdate({});
                            } else {
                              alert('Błąd podczas usuwania załącznika');
                            }
                          } catch (error) {
                            console.error('Error deleting evidence:', error);
                            alert('Błąd podczas usuwania załącznika');
                          }
                        }}
                        className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded"
                        title="Usuń"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </td>

      {/* Actions */}
      <td className="py-2 px-2 text-center" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onDelete}
          className="text-red-400 hover:text-red-300 text-xs"
          title="Usuń wydatek"
        >
          ✕
        </button>
      </td>
    </tr>
  );
}

