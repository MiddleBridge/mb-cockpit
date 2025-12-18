'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import TransactionDrawerDocuments from '@/components/finance/TransactionDrawerDocuments';
import * as documentsActions from '@/app/actions/documents';
import { useOrganisations } from '@/app/hooks/useSharedLists';
import { supabase } from '@/lib/supabase';

// Transaction data structure matching database schema
interface FinanceTransaction {
  id: string;
  org_id: string;
  source_document_id: string;
  booking_date: string;
  value_date: string | null;
  amount: number;
  currency: string;
  description: string;
  counterparty_name: string | null;
  counterparty_account: string | null;
  direction: 'in' | 'out';
  category: string;
  subcategory: string | null;
  transaction_hash: string;
  raw: Record<string, any>;
  created_at: string;
}

export default function FinanceView() {
  const router = useRouter();
  const [selectedTransaction, setSelectedTransaction] = useState<FinanceTransaction | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const { organisations, loading: orgsLoading } = useOrganisations();
  
  const hasOrganisations = organisations.length > 0;
  const currentOrgId = organisations.length > 0 ? organisations[0].id : null;

  // Load transactions from database
  useEffect(() => {
    const loadTransactions = async () => {
      setLoadingTransactions(true);
      try {
        // Load all transactions to see what's in the database
        const { data, error } = await supabase
          .from('finance_transactions')
          .select('*')
          .order('booking_date', { ascending: false });

        if (error) {
          console.error('Error loading transactions:', error);
          setTransactions([]);
        } else {
          // Log transaction org_ids to diagnose
          const orgIds = [...new Set((data || []).map(t => t.org_id))];
          console.log('[FinanceView] Loaded transactions:', { 
            count: data?.length || 0, 
            currentOrgId, 
            transactionOrgIds: orgIds,
            allOrgs: organisations.map(o => ({ id: o.id, name: o.name }))
          });
          
          // If we have a current org, filter by it, otherwise show all
          const filtered = currentOrgId 
            ? (data || []).filter(t => t.org_id === currentOrgId)
            : (data || []);
          
          console.log('[FinanceView] Filtered transactions:', { count: filtered.length, currentOrgId });
          setTransactions(filtered);
        }
      } catch (error) {
        console.error('Error loading transactions:', error);
        setTransactions([]);
      } finally {
        setLoadingTransactions(false);
      }
    };

    loadTransactions();
  }, [currentOrgId, organisations]);

  const handleUploadBankStatement = async (file: File) => {
    setUploading(true);
    try {
      // orgId will be resolved server-side from available organisations
      const result = await documentsActions.uploadDocumentAndLinkToEntity(null, file, {
        docType: 'BANK_CONFIRMATION',
        title: file.name,
      });
      
      // Reload transactions after upload - reload all then filter
      const { data } = await supabase
        .from('finance_transactions')
        .select('*')
        .order('booking_date', { ascending: false });
      
      if (data) {
        const orgIds = [...new Set(data.map(t => t.org_id))];
        console.log('[FinanceView] Reloaded transactions after upload:', { 
          count: data.length,
          transactionOrgIds: orgIds,
          currentOrgId 
        });
        
        // Filter by current org if set
        const filtered = currentOrgId 
          ? data.filter(t => t.org_id === currentOrgId)
          : data;
        
        setTransactions(filtered);
      }
      router.refresh(); // Refresh the page to show new data

      // Show import result if available
      const importResult = (result as any)?.import;
      if (importResult?.ok) {
        alert(`Wyciąg bankowy został przesłany!\n\nZaimportowano: ${importResult.upserted} transakcji\nSparsowano: ${importResult.parsed} wierszy\nPrawidłowych: ${importResult.valid}\nNieprawidłowych: ${importResult.invalid}`);
      } else if (importResult && !importResult.ok) {
        alert(`Wyciąg bankowy został przesłany, ale import nie powiódł się:\nKrok: ${importResult.step}\nBłąd: ${importResult.error}`);
      } else {
        alert('Wyciąg bankowy został przesłany!');
      }
      
      setShowUploadModal(false);
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error';
      if (errorMessage.includes('Wybierz organizację') || errorMessage.includes('ORG_REQUIRED')) {
        alert('Błąd: ' + errorMessage + '\n\nNajpierw utwórz organizację w sekcji "Organisations".');
      } else {
        alert('Błąd podczas przesyłania: ' + errorMessage);
      }
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
          {hasOrganisations ? (
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded"
            >
              📄 Wrzuć wyciąg bankowy
            </button>
          ) : (
            <div className="px-4 py-2 text-sm text-neutral-400 bg-neutral-800 rounded border border-neutral-700">
              Najpierw utwórz organizację w sekcji "Organisations"
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 relative">
        {!hasOrganisations && !orgsLoading ? (
          <div className="text-center py-12">
            <div className="text-neutral-400 text-sm mb-4">
              Brak organizacji. Najpierw utwórz organizację w sekcji "Organisations".
            </div>
            <div className="text-xs text-neutral-500">
              Po utworzeniu organizacji będziesz mógł wrzucać wyciągi bankowe.
            </div>
          </div>
        ) : loadingTransactions ? (
          <div className="text-center py-12">
            <div className="text-neutral-400 text-sm">Ładowanie transakcji...</div>
          </div>
        ) : transactions.length > 0 ? (
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
                      {transaction.booking_date} • {transaction.direction === 'in' ? '+' : '-'}{transaction.amount} {transaction.currency}
                    </div>
                    {transaction.description && (
                      <div className="text-xs text-neutral-500 mt-1">
                        {transaction.description.substring(0, 60)}
                        {transaction.description.length > 60 ? '...' : ''}
                      </div>
                    )}
                    {transaction.category && (
                      <div className="text-xs text-neutral-600 mt-1">
                        {transaction.category}
                        {transaction.subcategory && ` / ${transaction.subcategory}`}
                      </div>
                    )}
                  </div>
                  <div className={`text-xs font-medium ${transaction.direction === 'in' ? 'text-green-400' : 'text-red-400'}`}>
                    {transaction.direction === 'in' ? 'IN' : 'OUT'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-neutral-400 text-sm mb-4">
              Brak transakcji. Wrzuć wyciąg bankowy (CSV) używając przycisku powyżej.
            </div>
            <div className="text-xs text-neutral-500">
              Po wrzuceniu wyciągu transakcje zostaną automatycznie zaimportowane i skategoryzowane.
            </div>
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
                  orgId={selectedTransaction.org_id}
                  transactionId={selectedTransaction.id}
                  transaction={{
                    booking_date: selectedTransaction.booking_date,
                    amount: selectedTransaction.amount,
                    currency: selectedTransaction.currency,
                    direction: selectedTransaction.direction.toUpperCase() as 'IN' | 'OUT',
                    counterparty_name: selectedTransaction.counterparty_name || undefined,
                    counterparty_key: undefined,
                    reference: undefined,
                    description: selectedTransaction.description,
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && hasOrganisations && (
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
                accept=".csv,.txt"
                className="block w-full text-sm text-neutral-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-700"
              />
              {uploading && (
                <div className="mt-2 text-xs text-neutral-400">Przesyłanie...</div>
              )}
            </div>
            <div className="mt-4 text-xs text-neutral-500">
              Wyciąg bankowy (CSV) zostanie zapisany jako dokument typu BANK_CONFIRMATION. Transakcje zostaną automatycznie zaimportowane i skategoryzowane.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

