'use client';

import { useEffect, useState } from 'react';
import { Transaction } from '@/lib/finance/queries/getTransactions';
import { updateTransactionCategory } from '@/app/actions/finance/updateTransactionCategory';
import { updateTransactionReimbursement } from '@/app/actions/finance/updateTransactionReimbursement';
import { supabase } from '@/lib/supabase';
import EvidenceUploader from '@/components/evidence/EvidenceUploader';
import EvidenceGallery from '@/components/evidence/EvidenceGallery';
import * as tripsDb from '@/features/finance-trips/db/trips';
import * as tripItemsDb from '@/features/finance-trips/db/trip-items';
import type { FinanceTrip } from '@/features/finance-trips/db/trips';

interface TransactionDrawerProps {
  transaction: Transaction | null;
  onClose: () => void;
  categories: string[];
}

interface Document {
  id: string;
  name: string;
  file_url: string;
  storage_path: string;
}

export default function TransactionDrawer({
  transaction,
  onClose,
  categories,
}: TransactionDrawerProps) {
  const [document, setDocument] = useState<Document | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [editingCategory, setEditingCategory] = useState(false);
  const [category, setCategory] = useState(transaction?.category || 'uncategorised');
  const [paidByCompanyCard, setPaidByCompanyCard] = useState(transaction?.paid_by_company_card || false);
  const [excludeFromReimbursement, setExcludeFromReimbursement] = useState(transaction?.exclude_from_reimbursement || false);
  const [updatingReimbursement, setUpdatingReimbursement] = useState(false);
  const [trips, setTrips] = useState<FinanceTrip[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string>('');
  const [addingToTrip, setAddingToTrip] = useState(false);
  const [tripAdded, setTripAdded] = useState(false);

  useEffect(() => {
    if (transaction?.source_document_id) {
      loadDocument();
    }
    setCategory(transaction?.category || 'uncategorised');
    setPaidByCompanyCard(transaction?.paid_by_company_card || false);
    setExcludeFromReimbursement(transaction?.exclude_from_reimbursement || false);
    setTripAdded(false);
    setSelectedTripId('');
    
    // Load trips for this org
    const loadTrips = async () => {
      if (!transaction?.org_id) {
        console.log('[TransactionDrawer] No org_id, skipping trip load');
        setTrips([]);
        return;
      }
      try {
        console.log('[TransactionDrawer] Loading trips for org:', transaction.org_id);
        const tripsData = await tripsDb.getTrips(transaction.org_id);
        console.log('[TransactionDrawer] Loaded trips:', tripsData);
        setTrips(tripsData);
      } catch (error) {
        console.error('Error loading trips:', error);
        setTrips([]);
      }
    };
    
    loadTrips();
  }, [transaction]);

  const loadDocument = async () => {
    if (!transaction?.source_document_id) return;
    setLoadingDoc(true);
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('id, name, file_url, storage_path')
        .eq('id', transaction.source_document_id)
        .single();

      if (!error && data) {
        setDocument(data);
      }
    } catch (error) {
      console.error('Error loading document:', error);
    } finally {
      setLoadingDoc(false);
    }
  };

  const handleCategorySave = async () => {
    if (!transaction) return;
    try {
      const result = await updateTransactionCategory({
        transactionId: transaction.id,
        category,
      });
      if (result.ok) {
        setEditingCategory(false);
        // Update local transaction state
        // Parent component will reload on next render
      } else {
        alert(`Błąd podczas zapisywania kategorii: ${result.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Error saving category:', error);
      alert(`Błąd podczas zapisywania kategorii: ${error.message || 'Unknown error'}`);
    }
  };

  const handleAddToTrip = async () => {
    if (!transaction || !selectedTripId) return;
    
    setAddingToTrip(true);
    try {
      // Check if transaction is already added to a trip
      const usedIds = await tripItemsDb.getUsedTransactionIds();
      if (usedIds.includes(transaction.id)) {
        alert('Ta transakcja jest już dodana do tripu');
        setAddingToTrip(false);
        return;
      }

      const item = await tripItemsDb.createTripItem({
        org_id: transaction.org_id,
        trip_id: selectedTripId,
        source: 'transaction',
        transaction_id: transaction.id,
        item_date: transaction.booking_date,
        vendor: transaction.counterparty_name || null,
        description: transaction.description || null,
        category: transaction.category || null,
        amount: transaction.amount,
        currency: transaction.currency,
        paid_by_company_card: false,
        exclude_from_reimbursement: false,
        card_source: 'MB', // Automatically set to MB when adding from Finance Transactions
      });

      if (item) {
        setTripAdded(true);
        setSelectedTripId('');
        alert('Transakcja dodana do tripu');
      } else {
        alert('Błąd podczas dodawania do tripu');
      }
    } catch (error: any) {
      console.error('Error adding transaction to trip:', error);
      alert(`Błąd: ${error.message || 'Unknown error'}`);
    } finally {
      setAddingToTrip(false);
    }
  };

  const handleReimbursementToggle = async (field: 'paidByCompanyCard' | 'excludeFromReimbursement', value: boolean) => {
    if (!transaction) return;
    
    setUpdatingReimbursement(true);
    try {
      const updates: any = {};
      if (field === 'paidByCompanyCard') {
        updates.paidByCompanyCard = value;
        setPaidByCompanyCard(value);
      } else {
        updates.excludeFromReimbursement = value;
        setExcludeFromReimbursement(value);
      }

      const result = await updateTransactionReimbursement({
        transactionId: transaction.id,
        ...updates,
      });

      if (!result.ok) {
        // Revert on error
        if (field === 'paidByCompanyCard') {
          setPaidByCompanyCard(!value);
        } else {
          setExcludeFromReimbursement(!value);
        }
        alert(`Błąd podczas aktualizacji: ${result.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      // Revert on error
      if (field === 'paidByCompanyCard') {
        setPaidByCompanyCard(!value);
      } else {
        setExcludeFromReimbursement(!value);
      }
      console.error('Error updating reimbursement:', error);
      alert(`Błąd podczas aktualizacji: ${error.message || 'Unknown error'}`);
    } finally {
      setUpdatingReimbursement(false);
    }
  };

  // Calculate reimbursement amount
  const getReimbursementAmount = () => {
    if (!transaction) return 0;
    if (transaction.direction === 'in') return 0; // Only outbound transactions can be reimbursed
    if (paidByCompanyCard) return 0;
    if (excludeFromReimbursement) return 0;
    return Math.abs(transaction.amount);
  };

  const reimbursementAmount = getReimbursementAmount();

  if (!transaction) return null;

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
    <div className="h-full bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden flex flex-col">
      <div className="overflow-y-auto flex-1">
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between sticky top-0 bg-neutral-900 z-10">
          <h3 className="text-sm font-semibold text-white">Szczegóły transakcji</h3>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white text-lg"
            title="Zamknij"
          >
            ×
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Amount */}
          <div>
            <div className="text-xs text-neutral-400 mb-1">Kwota</div>
            <div className={`text-lg font-semibold ${
              transaction.direction === 'in' ? 'text-green-400' : 'text-red-400'
            }`}>
              {transaction.direction === 'in' ? '+' : ''}
              {formatCurrency(transaction.amount, transaction.currency)}
            </div>
          </div>

          {/* Date */}
          <div>
            <div className="text-xs text-neutral-400 mb-1">Data</div>
            <div className="text-sm text-white">{formatDate(transaction.booking_date)}</div>
          </div>

          {/* Description */}
          <div>
            <div className="text-xs text-neutral-400 mb-1">Opis</div>
            <div className="text-sm text-white">{transaction.description || 'Brak opisu'}</div>
          </div>

          {/* Counterparty */}
          {transaction.counterparty_name && (
            <div>
              <div className="text-xs text-neutral-400 mb-1">Kontrahent</div>
              <div className="text-sm text-white">{transaction.counterparty_name}</div>
              {transaction.counterparty_account && (
                <div className="text-xs text-neutral-400 mt-1">{transaction.counterparty_account}</div>
              )}
            </div>
          )}

          {/* Category */}
          <div>
            <div className="text-xs text-neutral-400 mb-1">Kategoria</div>
            {editingCategory ? (
              <div className="space-y-2">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="text-sm bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-white"
                >
                  <option value="uncategorised">Nieskategoryzowane</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button
                    onClick={handleCategorySave}
                    className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
                  >
                    Zapisz
                  </button>
                  <button
                    onClick={() => {
                      setEditingCategory(false);
                      setCategory(transaction.category || 'uncategorised');
                    }}
                    className="text-xs bg-neutral-700 hover:bg-neutral-600 text-white px-3 py-1 rounded"
                  >
                    Anuluj
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="text-sm text-white">{transaction.category || 'Nieskategoryzowane'}</div>
                <button
                  onClick={() => setEditingCategory(true)}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  Edytuj
                </button>
              </div>
            )}
          </div>

          {/* Document */}
          {loadingDoc ? (
            <div className="text-xs text-neutral-400">Ładowanie dokumentu...</div>
          ) : document ? (
            <div>
              <div className="text-xs text-neutral-400 mb-1">Dokument źródłowy</div>
              <a
                href={document.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-400 hover:text-blue-300"
              >
                {document.name}
              </a>
            </div>
          ) : null}

          {/* Add to Trip Section */}
          {transaction.direction === 'out' && (
            <div className="border-t border-neutral-800 pt-4 space-y-3">
              <div className="text-xs font-semibold text-neutral-300 mb-2">Dodaj do Trip</div>
              
              {tripAdded ? (
                <div className="bg-green-900/30 border border-green-700/50 rounded p-2 text-xs text-green-400">
                  ✓ Transakcja dodana do tripu
                </div>
              ) : (
                <div className="space-y-2">
                  <select
                    value={selectedTripId}
                    onChange={(e) => setSelectedTripId(e.target.value)}
                    className="w-full text-sm bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-white"
                  >
                    <option value="">Wybierz trip...</option>
                    {trips.map(trip => (
                      <option key={trip.id} value={trip.id}>
                        {trip.title}{trip.start_date && trip.end_date ? ` (${formatDate(trip.start_date)}–${formatDate(trip.end_date)})` : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleAddToTrip}
                    disabled={!selectedTripId || addingToTrip}
                    className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {addingToTrip ? 'Dodawanie...' : 'Dodaj do tripu (karta: MB)'}
                  </button>
                  <div className="text-xs text-neutral-500">
                    Transakcje dodane z Finance Transactions są automatycznie oznaczone jako płatność kartą MB
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Reimbursement Section */}
          {transaction.direction === 'out' && (
            <div className="border-t border-neutral-800 pt-4 space-y-3">
              <div className="text-xs font-semibold text-neutral-300 mb-2">Reimbursement</div>
              
              {/* To Reimburse Amount */}
              {reimbursementAmount > 0 && (
                <div className="bg-blue-900/30 border border-blue-700/50 rounded p-2">
                  <div className="text-xs text-neutral-400 mb-1">To reimburse</div>
                  <div className="text-lg font-semibold text-blue-400">
                    {formatCurrency(reimbursementAmount, transaction.currency)}
                  </div>
                </div>
              )}

              {/* Paid by company card toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-neutral-400 mb-1">Paid by company card</div>
                  <div className="text-xs text-neutral-500">If checked, reimbursement is 0</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={paidByCompanyCard}
                    onChange={(e) => handleReimbursementToggle('paidByCompanyCard', e.target.checked)}
                    disabled={updatingReimbursement}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-neutral-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Exclude from reimbursement toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-neutral-400 mb-1">Exclude from reimbursement</div>
                  <div className="text-xs text-neutral-500">For edge cases</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={excludeFromReimbursement}
                    onChange={(e) => handleReimbursementToggle('excludeFromReimbursement', e.target.checked)}
                    disabled={updatingReimbursement}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-neutral-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          )}

          {/* Evidence Section */}
          {transaction.project_id && (
            <div className="border-t border-neutral-800 pt-4 space-y-3">
              <div className="text-xs font-semibold text-neutral-300 mb-2">Evidence</div>
              
              <EvidenceGallery
                orgId={transaction.org_id}
                transactionId={transaction.id}
                projectId={transaction.project_id}
              />
              
              <EvidenceUploader
                orgId={transaction.org_id}
                projectId={transaction.project_id}
                linkType="transaction"
                linkId={transaction.id}
                onUploadSuccess={() => {
                  // Refresh evidence gallery by reloading the page or updating state
                  window.location.reload();
                }}
                onUploadError={(error) => alert(`Upload failed: ${error}`)}
              />
            </div>
          )}

          {/* Raw JSON */}
          <div>
            <div className="text-xs text-neutral-400 mb-1">Raw JSON</div>
            <pre className="text-xs bg-neutral-800 rounded p-2 overflow-auto max-h-40 text-neutral-300">
              {JSON.stringify(transaction.raw || {}, null, 2)}
            </pre>
          </div>

          {/* Audit */}
          <div>
            <div className="text-xs text-neutral-400 mb-1">Utworzono</div>
            <div className="text-xs text-neutral-500">
              {new Date(transaction.created_at).toLocaleString('pl-PL')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

