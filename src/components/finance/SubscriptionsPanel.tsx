'use client';

import { useState, useEffect } from 'react';

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
  monthlyTotal: number;
  processed: number;
  matched: number;
}

interface SubscriptionsPanelProps {
  orgId?: string | null;
}

export default function SubscriptionsPanel({ orgId }: SubscriptionsPanelProps) {
  const [subscriptions, setSubscriptions] = useState<DetectedSubscription[]>([]);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [includeNonSoftware, setIncludeNonSoftware] = useState(true);
  const [includeInactive, setIncludeInactive] = useState(false);

  useEffect(() => {
    loadSubscriptions();
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

  const handleDetect = async () => {
    // Always require orgId - never send null
    if (!orgId || orgId === 'placeholder-org-id') {
      alert('Wybierz organizację przed wykrywaniem subskrypcji');
      return;
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(orgId)) {
      alert('Nieprawidłowy identyfikator organizacji');
      return;
    }

    setDetecting(true);
    try {
      const response = await fetch('/api/finance/subscriptions/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId }),
      });

      // Check HTTP status first
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        const errorMsg = errorData.error || `HTTP ${response.status}: ${response.statusText}`;
        console.error('[SubscriptionsPanel] API error:', errorMsg);
        alert(`Błąd podczas wykrywania: ${errorMsg}`);
        return;
      }

      const result: { ok: boolean } & DetectionResult = await response.json();
      
      if (result.ok) {
        console.log('[SubscriptionsPanel] Detection complete:', result);
        
        // Convert to DetectedSubscription format
        const converted: DetectedSubscription[] = (result.subscriptions || []).map((sub: any) => ({
          vendor_key: sub.vendorKey || sub.vendor_key,
          display_name: sub.displayName || sub.display_name,
          cadence: 'monthly' as const,
          currency: sub.currency || 'PLN',
          avg_amount: sub.monthlyAmount || sub.avg_amount || 0,
          amount_tolerance: 0,
          last_charge_date: sub.lastChargeDate || sub.last_charge_date || '',
          next_expected_date: null,
          first_seen_date: sub.lastChargeDate || sub.last_charge_date || '',
          active: true,
          confidence: 90,
          source: 'auto' as const,
          transaction_ids: Array(sub.occurrences || 0).fill(''), // Array length = count of transactions
          servicePeriodMonths: sub.serviceMonths || [],
        }));

        setSubscriptions(converted);
        setMonthlyTotal(result.totalMonthly || 0);
        
        if (converted.length === 0) {
          console.warn('[SubscriptionsPanel] No subscriptions detected. Debug:', result.debug);
        }
      } else {
        const errorMsg = (result as any).error || 'Unknown error';
        console.error('[SubscriptionsPanel] Detection failed:', errorMsg);
        alert(`Błąd podczas wykrywania: ${errorMsg}`);
      }
    } catch (error: any) {
      console.error('[SubscriptionsPanel] Network error:', error);
      alert(`Błąd połączenia: ${error?.message || 'Unknown error'}`);
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
          disabled={detecting || !orgId}
          className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Wykryj cykliczne płatności w transakcjach"
        >
          {detecting ? 'Wykrywanie...' : '🔄 Wykryj'}
        </button>
      </div>

      {subscriptions.length === 0 && !detecting && (
        <div className="text-xs text-neutral-500 py-2">
          Brak wykrytych subskrypcji. Kliknij "Wykryj" aby przeanalizować transakcje.
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

          {/* Active Subscriptions Table */}
          {activeSubscriptions.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-green-400 mb-2 uppercase tracking-wider">
                Aktywne ({activeSubscriptions.length})
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-neutral-700 text-neutral-400">
                      <th className="text-left py-2 px-2">Vendor</th>
                      <th className="text-right py-2 px-2">Miesięczny koszt</th>
                      <th className="text-left py-2 px-2">Ostatnia płatność</th>
                      <th className="text-center py-2 px-2">Status</th>
                      <th className="text-right py-2 px-2">Transakcje</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeSubscriptions.map((sub) => (
                      <tr key={sub.vendor_key} className="border-b border-neutral-800/50 hover:bg-neutral-800/30">
                        <td className="py-2 px-2">
                          <div className="font-medium text-white">{sub.display_name}</div>
                          <div className="text-[10px] text-neutral-500 mt-0.5">
                            {sub.source === 'rule' ? '✓ Reguła' : '🔍 Auto'}
                          </div>
                        </td>
                        <td className="py-2 px-2 text-right">
                          <div className="text-white font-medium">
                            {formatAmount(sub.avg_amount, sub.currency)}
                          </div>
                        </td>
                        <td className="py-2 px-2 text-neutral-400">
                          {formatDate(sub.last_charge_date)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span className="text-green-400 text-[10px] font-medium">● Aktywna</span>
                        </td>
                        <td className="py-2 px-2 text-right">
                          <div className="text-neutral-300 text-xs">
                            {sub.transaction_ids.length || 0}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Inactive Subscriptions */}
          {inactiveSubscriptions.length > 0 && includeInactive && (
            <div>
              <h4 className="text-xs font-medium text-neutral-500 mb-2 uppercase tracking-wider">
                Nieaktywne ({inactiveSubscriptions.length})
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs opacity-75">
                  <thead>
                    <tr className="border-b border-neutral-700/50 text-neutral-500">
                      <th className="text-left py-2 px-2">Vendor</th>
                      <th className="text-right py-2 px-2">Miesięczny koszt</th>
                      <th className="text-left py-2 px-2">Ostatnia płatność</th>
                      <th className="text-center py-2 px-2">Status</th>
                      <th className="text-right py-2 px-2">Pewność</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inactiveSubscriptions.map((sub) => (
                      <tr key={sub.vendor_key} className="border-b border-neutral-800/30">
                        <td className="py-2 px-2">
                          <div className="font-medium text-neutral-300">{sub.display_name}</div>
                          <div className="text-[10px] text-neutral-600 mt-0.5">
                            {sub.source === 'rule' ? '✓ Reguła' : '🔍 Auto'}
                          </div>
                        </td>
                        <td className="py-2 px-2 text-right">
                          <div className="text-neutral-300 font-medium">
                            {formatAmount(sub.avg_amount, sub.currency)}
                          </div>
                        </td>
                        <td className="py-2 px-2 text-neutral-500">
                          {formatDate(sub.last_charge_date)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span className="text-neutral-500 text-[10px]">○ Nieaktywna</span>
                        </td>
                        <td className="py-2 px-2 text-right">
                          <div className="text-neutral-500">
                            {Math.round(sub.confidence)}%
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
