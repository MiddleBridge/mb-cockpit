'use client';

import { useState } from 'react';
import TransactionDrawerDocuments from '@/components/finance/TransactionDrawerDocuments';
import * as documentsActions from '@/app/actions/documents';

// Placeholder - replace with actual transaction data structure
interface FinanceTransaction {
  id: string;
  booking_date: string;
  amount: number;
  currency: string;
  direction: 'IN' | 'OUT';
  counterparty_name?: string;
  counterparty_key?: string;
  reference?: string;
  description?: string;
  organisation_id: string;
}

export default function FinanceView() {
  const [selectedTransaction, setSelectedTransaction] = useState<FinanceTransaction | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // TODO: Replace with actual transaction data fetching
  // For now, this is a placeholder view
  const transactions: FinanceTransaction[] = [];

  const handleUploadBankStatement = async (file: File) => {
    // Get org_id from context or user settings
    // For now, using a placeholder - you'll need to get this from your auth/org context
    const orgId = 'placeholder-org-id'; // TODO: Get from context
    
    setUploading(true);
    try {
      await documentsActions.uploadDocumentAndLinkToEntity(orgId, file, {
        docType: 'BANK_CONFIRMATION',
        title: file.name,
      });
      alert('Wyciąg bankowy został przesłany!');
      setShowUploadModal(false);
    } catch (error: any) {
      alert('Błąd podczas przesyłania: ' + (error.message || 'Unknown error'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-neutral-900 text-white">
      {/* Header */}
      <div className="p-4 border-b border-neutral-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Finance Transactions</h2>
            <p className="text-xs text-neutral-400 mt-1">Zarządzaj transakcjami finansowymi i dokumentami</p>
          </div>
          <button
            onClick={() => setShowUploadModal(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded"
          >
            📄 Wrzuć wyciąg bankowy
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {transactions.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-neutral-400 text-sm mb-4">
              Brak transakcji. Najpierw musisz utworzyć tabelę transakcji finansowych w bazie danych.
            </div>
            <div className="text-xs text-neutral-500">
              Możesz wrzucić wyciąg bankowy używając przycisku powyżej - dokument zostanie zapisany i będzie gotowy do powiązania z transakcjami.
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((transaction) => (
              <div
                key={transaction.id}
                onClick={() => setSelectedTransaction(transaction)}
                className="p-4 bg-neutral-800 rounded border border-neutral-700 hover:bg-neutral-750 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">
                      {transaction.counterparty_name || 'Unknown'}
                    </div>
                    <div className="text-xs text-neutral-400 mt-1">
                      {transaction.booking_date} • {transaction.amount} {transaction.currency}
                    </div>
                  </div>
                  <div className="text-xs text-neutral-500">
                    {transaction.direction}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Transaction Detail Drawer */}
        {selectedTransaction && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-end">
            <div className="w-full max-w-md h-full bg-neutral-900 border-l border-neutral-800 overflow-y-auto">
              <div className="p-4 border-b border-neutral-800">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">Transaction Details</h3>
                  <button
                    onClick={() => setSelectedTransaction(null)}
                    className="text-neutral-400 hover:text-white text-xl"
                  >
                    ×
                  </button>
                </div>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <div className="text-xs text-neutral-400 mb-1">Amount</div>
                  <div className="text-sm text-white">
                    {selectedTransaction.amount} {selectedTransaction.currency}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-neutral-400 mb-1">Date</div>
                  <div className="text-sm text-white">{selectedTransaction.booking_date}</div>
                </div>
                <div>
                  <div className="text-xs text-neutral-400 mb-1">Counterparty</div>
                  <div className="text-sm text-white">
                    {selectedTransaction.counterparty_name || 'Unknown'}
                  </div>
                </div>
                
                {/* Documents Section */}
                <TransactionDrawerDocuments
                  orgId={selectedTransaction.organisation_id}
                  transactionId={selectedTransaction.id}
                  transaction={{
                    booking_date: selectedTransaction.booking_date,
                    amount: selectedTransaction.amount,
                    currency: selectedTransaction.currency,
                    direction: selectedTransaction.direction,
                    counterparty_name: selectedTransaction.counterparty_name,
                    counterparty_key: selectedTransaction.counterparty_key,
                    reference: selectedTransaction.reference,
                    description: selectedTransaction.description,
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowUploadModal(false)}
        >
          <div
            className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Wrzuć wyciąg bankowy</h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-neutral-400 hover:text-white text-xl"
              >
                ×
              </button>
            </div>
            <div>
              <input
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleUploadBankStatement(file);
                  }
                }}
                disabled={uploading}
                accept=".pdf,.jpg,.jpeg,.png"
                className="block w-full text-sm text-neutral-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-700"
              />
              {uploading && (
                <div className="mt-2 text-xs text-neutral-400">Przesyłanie...</div>
              )}
            </div>
            <div className="mt-4 text-xs text-neutral-500">
              Wyciąg bankowy zostanie zapisany jako dokument typu BANK_CONFIRMATION i będzie gotowy do powiązania z transakcjami.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

