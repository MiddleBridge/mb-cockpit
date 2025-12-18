'use client';

import { useState, useEffect } from 'react';
import { Subscription } from '@/lib/finance/queries/getSubscriptions';
import { getSubscriptions } from '@/lib/finance/queries/getSubscriptions';

interface SubscriptionsPanelProps {
  orgId?: string | null;
}

export default function SubscriptionsPanel({ orgId }: SubscriptionsPanelProps) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);

  useEffect(() => {
    loadSubscriptions();
  }, [orgId]);

  const loadSubscriptions = async () => {
    setLoading(true);
    try {
      const data = await getSubscriptions({ orgId });
      setSubscriptions(data);
    } catch (error) {
      console.error('Error loading subscriptions:', error);
      setSubscriptions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDetectRecurring = async () => {
    setDetecting(true);
    try {
      const response = await fetch('/api/finance/detect-recurring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId }),
      });

      const result = await response.json();
      
      if (result.ok) {
        console.log('[SubscriptionsPanel] Detection complete:', result);
        // Reload subscriptions after detection
        await loadSubscriptions();
        alert(`Wykryto cykliczne płatności: ${result.updated} transakcji zaktualizowanych`);
      } else {
        alert('Błąd podczas wykrywania: ' + (result.error || 'Unknown error'));
      }
    } catch (error: any) {
      console.error('Error detecting recurring:', error);
      alert('Błąd podczas wykrywania: ' + (error?.message || 'Unknown error'));
    } finally {
      setDetecting(false);
    }
  };

  const activeSubscriptions = subscriptions.filter(s => s.is_active);
  const pastSubscriptions = subscriptions.filter(s => !s.is_active);

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

  const formatAmountRange = (min: number, max: number, currency: string) => {
    if (min === max) {
      return formatAmount(min, currency);
    }
    return `${formatAmount(min, currency)} - ${formatAmount(max, currency)}`;
  };

  const getPatternLabel = (pattern: string) => {
    const labels: Record<string, string> = {
      monthly: 'miesięcznie',
      quarterly: 'kwartalnie',
      yearly: 'rocznie',
      weekly: 'tygodniowo',
    };
    return labels[pattern] || pattern;
  };

  if (loading) {
    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
        <div className="text-sm text-neutral-400">Ładowanie subskrypcji...</div>
      </div>
    );
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">Subskrypcje</h3>
        <button
          onClick={handleDetectRecurring}
          disabled={detecting}
          className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Wykryj cykliczne płatności w transakcjach"
        >
          {detecting ? 'Wykrywanie...' : '🔄 Wykryj'}
        </button>
      </div>

      {subscriptions.length === 0 && (
        <div className="text-xs text-neutral-500 py-2">
          Brak wykrytych subskrypcji. Kliknij "Wykryj" aby przeanalizować transakcje.
        </div>
      )}

      {/* Active Subscriptions */}
      {activeSubscriptions.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-green-400 mb-2 uppercase tracking-wider">
            Aktywne ({activeSubscriptions.length})
          </h4>
          <div className="space-y-2">
            {activeSubscriptions.map((sub) => (
              <div
                key={sub.recurrence_group_id}
                className="bg-neutral-800/50 border border-neutral-700 rounded p-3 text-xs"
              >
                <div className="flex items-start justify-between mb-1">
                  <div className="flex-1">
                    <div className="font-medium text-white mb-0.5">
                      {sub.counterparty_name || sub.description}
                    </div>
                    <div className="text-neutral-400 text-[10px]">
                      {sub.description !== sub.counterparty_name && sub.description}
                    </div>
                  </div>
                  <div className="text-right ml-2">
                    <div className="text-white font-medium">
                      {formatAmountRange(sub.min_amount, sub.max_amount, sub.currency)}
                    </div>
                    <div className="text-neutral-500 text-[10px]">
                      / {getPatternLabel(sub.recurrence_pattern)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-neutral-700">
                  <div className="text-neutral-500 text-[10px]">
                    Od: {formatDate(sub.first_transaction_date)}
                  </div>
                  <div className="text-green-400 text-[10px] font-medium">
                    ● Aktywna
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Past Subscriptions */}
      {pastSubscriptions.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-neutral-500 mb-2 uppercase tracking-wider">
            Przeszłe ({pastSubscriptions.length})
          </h4>
          <div className="space-y-2">
            {pastSubscriptions.map((sub) => (
              <div
                key={sub.recurrence_group_id}
                className="bg-neutral-800/30 border border-neutral-700/50 rounded p-3 text-xs opacity-75"
              >
                <div className="flex items-start justify-between mb-1">
                  <div className="flex-1">
                    <div className="font-medium text-neutral-300 mb-0.5">
                      {sub.counterparty_name || sub.description}
                    </div>
                    <div className="text-neutral-500 text-[10px]">
                      {sub.description !== sub.counterparty_name && sub.description}
                    </div>
                  </div>
                  <div className="text-right ml-2">
                    <div className="text-neutral-300 font-medium">
                      {formatAmountRange(sub.min_amount, sub.max_amount, sub.currency)}
                    </div>
                    <div className="text-neutral-600 text-[10px]">
                      / {getPatternLabel(sub.recurrence_pattern)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-neutral-700/50">
                  <div className="text-neutral-600 text-[10px]">
                    Od: {formatDate(sub.first_transaction_date)} • Do: {formatDate(sub.last_transaction_date)}
                  </div>
                  <div className="text-neutral-500 text-[10px]">
                    {sub.transaction_count} transakcji
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

