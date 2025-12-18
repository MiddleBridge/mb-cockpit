'use client';

import { useEffect, useState } from 'react';
import { Transaction } from '@/lib/finance/queries/getTransactions';
import { updateTransactionCategory } from '@/app/actions/finance/updateTransactionCategory';
import { supabase } from '@/lib/supabase';

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

  useEffect(() => {
    if (transaction?.source_document_id) {
      loadDocument();
    }
    setCategory(transaction?.category || 'uncategorised');
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
    const result = await updateTransactionCategory({
      transactionId: transaction.id,
      category,
    });
    if (result.ok) {
      setEditingCategory(false);
      // Optionally refresh parent
    }
  };

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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-end">
      <div className="w-full max-w-md h-full bg-neutral-900 border-l border-neutral-800 overflow-y-auto">
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Szczegóły transakcji</h3>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white text-xl"
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

