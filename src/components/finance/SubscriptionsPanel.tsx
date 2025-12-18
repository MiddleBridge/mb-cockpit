'use client';

import { useState, useEffect } from 'react';
import { detectSubscriptionsFromTransactions } from '@/lib/finance/subscriptions/detectFromTransactions';

interface DetectedSubscription {
  vendor_key: string;
  display_name: string;
  cadence: 'monthly';
  currency: string;
  avg_amount: number;
  amount_tolerance: number;
  last_charge_date: string;
  next_expected_date: string | null;
  first_seen_date: string;
  active: boolean;
  confidence: number;
  source: 'rule' | 'auto';
  transaction_ids: string[];
  servicePeriodMonths: (string | null)[];
}

interface DetectionResult {
  subscriptions: DetectedSubscription[];
  totalMonthly: number;
  debug: {
    fetchedCount: number;
    matchedCounts: Record<string, number>;
  };
}

interface SubscriptionsPanelProps {
  orgId?: string | null;
  transactions?: Array<{
    id: string;
    booking_date: string;
    description?: string | null;
    counterparty_name?: string | null;
    amount: number | string;
    currency?: string;
  }>;
}

export default function SubscriptionsPanel({ orgId, transactions = [] }: SubscriptionsPanelProps) {
  const [subscriptions, setSubscriptions] = useState<DetectedSubscription[]>([]);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [includeNonSoftware, setIncludeNonSoftware] = useState(true);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  useEffect(() => {
    loadSubscriptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const loadSubscriptions = async () => {
    if (!orgId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/finance/subscriptions/get', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId }),
      });

      const result: { ok: boolean; subscriptions?: any[] } = await response.json();
      
      if (result.ok && result.subscriptions) {
        // Convert database format to DetectedSubscription format
        const converted = result.subscriptions.map((sub: any) => ({
          vendor_key: sub.vendor_key,
          display_name: sub.display_name,
          cadence: sub.cadence as 'monthly',
          currency: sub.currency,
          avg_amount: Number(sub.avg_amount),
          amount_tolerance: Number(sub.amount_tolerance),
          last_charge_date: sub.last_charge_date || '',
          next_expected_date: sub.next_expected_date,
          first_seen_date: sub.first_seen_date || '',
          active: sub.active,
          confidence: Number(sub.confidence),
          source: sub.source as 'rule' | 'auto',
          transaction_ids: [], // Will be loaded separately if needed
          servicePeriodMonths: [], // Will be loaded separately if needed
        }));

        setSubscriptions(converted);
        
        // Calculate monthly total
        const total = converted
          .filter(s => s.active && s.cadence === 'monthly')
          .reduce((sum, s) => sum + s.avg_amount, 0);
        setMonthlyTotal(total);
      }
    } catch (error) {
      console.error('Error loading subscriptions:', error);
      setSubscriptions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDetect = () => {
    // Client-side detection from current transactions
    if (!transactions || transactions.length === 0) {
      alert('Brak transakcji do analizy. Załaduj transakcje w tabeli powyżej.');
      return;
    }

    setDetecting(true);
    try {
      // Convert transactions to detector format
      const detectorInput = transactions.map(tx => ({
        id: tx.id,
        date: tx.booking_date,
        description: tx.description || null,
        title: null,
        counterparty: tx.counterparty_name || null,
        counterparty_name: tx.counterparty_name || null,
        amount: tx.amount,
        currency: tx.currency || 'PLN',
      }));

      console.log('[SubscriptionsPanel] Detecting from', detectorInput.length, 'transactions');

      // Run client-side detection
      const result = detectSubscriptionsFromTransactions(detectorInput);

      console.log('[SubscriptionsPanel] Detection complete:', result);

      // Check for errors
      if (result.debug.expenseCount === 0) {
        alert('Brak wydatków w aktualnym widoku. Zmień filtry aby zobaczyć wydatki.');
        setDetecting(false);
        return;
      }

      if (result.subscriptions.length === 0) {
        const sampleText = Object.entries(result.debug.sampleMatches)
          .map(([vendor, samples]) => `${vendor}: ${samples.join(', ')}`)
          .join('\n');
        alert(`Nie wykryto subskrypcji.\n\nPrzeanalizowano ${result.debug.expenseCount} wydatków.\nDopasowania: ${JSON.stringify(result.debug.matchedCounts, null, 2)}\n\nPrzykłady tekstów: ${sampleText || 'brak'}`);
        setDetecting(false);
        return;
      }

      // Convert to DetectedSubscription format
      const converted: DetectedSubscription[] = result.subscriptions.map(sub => ({
        vendor_key: sub.vendorKey,
        display_name: sub.displayName,
        cadence: 'monthly' as const,
        currency: sub.currency,
        avg_amount: sub.monthlyAmount,
        amount_tolerance: 0,
        last_charge_date: sub.lastChargeDate,
        next_expected_date: null,
        first_seen_date: sub.lastChargeDate,
        active: true,
        confidence: sub.confidence,
        source: 'auto' as const,
        transaction_ids: sub.matchedTransactionIds,
        servicePeriodMonths: [],
      }));

      setSubscriptions(converted);
      setMonthlyTotal(result.totalMonthly);
      setDebugInfo(result.debug);
      
      console.log('[SubscriptionsPanel] Set subscriptions:', converted.length, 'total:', result.totalMonthly);
    } catch (error: any) {
      console.error('[SubscriptionsPanel] Detection error:', error);
      alert(`Błąd podczas wykrywania: ${error?.message || 'Unknown error'}`);
    } finally {
      setDetecting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pl-PL', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: currency || 'PLN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Filter subscriptions
  const filteredSubscriptions = subscriptions.filter(sub => {
    if (!includeInactive && !sub.active) return false;
    
    // Filter non-software if needed
    if (!includeNonSoftware) {
      const nonSoftwareKeys = ['rent', 'hermi_accounting'];
      if (nonSoftwareKeys.includes(sub.vendor_key)) return false;
    }
    
    return true;
  });

  // Calculate filtered monthly total
  const filteredMonthlyTotal = filteredSubscriptions
    .filter(s => s.active && s.cadence === 'monthly')
    .reduce((sum, s) => sum + s.avg_amount, 0);

  const activeSubscriptions = filteredSubscriptions.filter(s => s.active);
  const inactiveSubscriptions = filteredSubscriptions.filter(s => !s.active);

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">Subskrypcje</h3>
        <button
          onClick={handleDetect}
          disabled={detecting || transactions.length === 0}
          className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          title={transactions.length === 0 ? 'Załaduj transakcje aby wykryć subskrypcje' : 'Wykryj cykliczne płatności w transakcjach'}
        >
          {detecting ? 'Wykrywanie...' : '🔄 Wykryj'}
        </button>
      </div>

      {subscriptions.length === 0 && !detecting && !loading && (
        <div className="text-xs text-neutral-500 py-2">
          {transactions.length === 0
            ? 'Załaduj transakcje w tabeli powyżej, a następnie kliknij "Wykryj".'
            : 'Brak wykrytych subskrypcji. Kliknij "Wykryj" aby przeanalizować transakcje.'}
        </div>
      )}

      {subscriptions.length > 0 && (
        <>
          {/* Total Monthly Maintenance Cost */}
          <div className="bg-neutral-800/50 border border-neutral-700 rounded p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-neutral-400 mb-1">Miesięczny koszt utrzymania</div>
                <div className="text-lg font-semibold text-white">
                  {formatAmount(filteredMonthlyTotal, 'PLN')}
                </div>
              </div>
              <div className="flex flex-col gap-1 text-xs">
                <label className="flex items-center gap-2 text-neutral-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeNonSoftware}
                    onChange={(e) => setIncludeNonSoftware(e.target.checked)}
                    className="w-3 h-3"
                  />
                  <span>Uwzględnij koszty nie-software</span>
                </label>
                <label className="flex items-center gap-2 text-neutral-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeInactive}
                    onChange={(e) => setIncludeInactive(e.target.checked)}
                    className="w-3 h-3"
                  />
                  <span>Pokaż nieaktywne</span>
                </label>
              </div>
            </div>
          </div>

          {/* Active Subscriptions Table - Compact */}
          {activeSubscriptions.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-green-400 mb-2 uppercase tracking-wider">
                Aktywne ({activeSubscriptions.length})
              </h4>
              <div className="space-y-1">
                {activeSubscriptions.map((sub) => (
                  <div
                    key={sub.vendor_key}
                    className="flex items-center justify-between gap-2 py-1.5 px-2 border-b border-neutral-800/50 hover:bg-neutral-800/30 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-green-400 text-[10px]">●</span>
                      <span className="font-medium text-white truncate">{sub.display_name}</span>
                      <span className="text-[10px] text-neutral-500 whitespace-nowrap">
                        {sub.source === 'rule' ? '✓' : '🔍'}
                      </span>
                    </div>
                    <div className="text-white font-medium whitespace-nowrap">
                      {formatAmount(sub.avg_amount, sub.currency)}
                    </div>
                    <div className="text-neutral-400 text-[10px] whitespace-nowrap min-w-[70px]">
                      {formatDate(sub.last_charge_date)}
                    </div>
                    <div className="text-neutral-300 text-[10px] whitespace-nowrap min-w-[60px] text-right">
                      {sub.transaction_ids?.length || 0} tx · {Math.round(sub.confidence)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Inactive Subscriptions - Compact */}
          {inactiveSubscriptions.length > 0 && includeInactive && (
            <div className="opacity-75">
              <h4 className="text-xs font-medium text-neutral-500 mb-2 uppercase tracking-wider">
                Nieaktywne ({inactiveSubscriptions.length})
              </h4>
              <div className="space-y-1">
                {inactiveSubscriptions.map((sub) => (
                  <div
                    key={sub.vendor_key}
                    className="flex items-center justify-between gap-2 py-1.5 px-2 border-b border-neutral-800/30 hover:bg-neutral-800/20 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-neutral-500 text-[10px]">○</span>
                      <span className="font-medium text-neutral-300 truncate">{sub.display_name}</span>
                      <span className="text-[10px] text-neutral-600 whitespace-nowrap">
                        {sub.source === 'rule' ? '✓' : '🔍'}
                      </span>
                    </div>
                    <div className="text-neutral-300 font-medium whitespace-nowrap">
                      {formatAmount(sub.avg_amount, sub.currency)}
                    </div>
                    <div className="text-neutral-500 text-[10px] whitespace-nowrap min-w-[70px]">
                      {formatDate(sub.last_charge_date)}
                    </div>
                    <div className="text-neutral-500 text-[10px] whitespace-nowrap min-w-[60px] text-right">
                      {sub.transaction_ids?.length || 0} tx · {Math.round(sub.confidence)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Debug Section (development only) */}
          {debugInfo && (
            <div className="mt-4 border-t border-neutral-700 pt-4">
              <button
                onClick={() => setShowDebug(!showDebug)}
                className="text-xs text-neutral-500 hover:text-neutral-400 mb-2"
              >
                {showDebug ? '▼' : '▶'} Debug Info
              </button>
              {showDebug && (
                <div className="bg-neutral-800/50 rounded p-3 text-xs space-y-2">
                  <div>
                    <span className="text-neutral-400">Input count:</span>{' '}
                    <span className="text-white">{debugInfo.inputCount}</span>
                  </div>
                  <div>
                    <span className="text-neutral-400">Expense count:</span>{' '}
                    <span className="text-white">{debugInfo.expenseCount}</span>
                  </div>
                  <div>
                    <span className="text-neutral-400">Matched counts:</span>
                    <pre className="text-neutral-300 mt-1 text-[10px]">
                      {JSON.stringify(debugInfo.matchedCounts, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <span className="text-neutral-400">Sample matches:</span>
                    {Object.entries(debugInfo.sampleMatches || {}).map(([vendor, samples]: [string, any]) => (
                      <div key={vendor} className="mt-1">
                        <span className="text-neutral-500">{vendor}:</span>
                        <ul className="list-disc list-inside ml-2 text-[10px] text-neutral-400">
                          {samples.map((sample: string, i: number) => (
                            <li key={i} className="truncate">{sample}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
