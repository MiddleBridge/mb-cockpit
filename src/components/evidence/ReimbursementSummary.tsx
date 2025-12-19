'use client';

import { Transaction } from '@/lib/finance/queries/getTransactions';

interface ReimbursementSummaryProps {
  transactions: Transaction[];
  className?: string;
}

interface CurrencyTotal {
  currency: string;
  total: number;
  items: Array<{
    id: string;
    vendor: string;
    date: string;
    amount: number;
    currency: string;
    category: string;
  }>;
}

export default function ReimbursementSummary({
  transactions,
  className = '',
}: ReimbursementSummaryProps) {
  // Filter and calculate reimbursable transactions
  const getReimbursableTransactions = (): CurrencyTotal[] => {
    const reimbursable = transactions.filter(t => {
      // Only outbound transactions can be reimbursed
      if (t.direction === 'in') return false;
      // Skip if paid by company card
      if (t.paid_by_company_card) return false;
      // Skip if excluded
      if (t.exclude_from_reimbursement) return false;
      return true;
    });

    // Group by currency
    const byCurrency: Record<string, CurrencyTotal> = {};

    reimbursable.forEach(transaction => {
      const currency = transaction.currency || 'PLN';
      if (!byCurrency[currency]) {
        byCurrency[currency] = {
          currency,
          total: 0,
          items: [],
        };
      }

      const amount = Math.abs(transaction.amount);
      byCurrency[currency].total += amount;
      byCurrency[currency].items.push({
        id: transaction.id,
        vendor: transaction.counterparty_name || transaction.description || 'Unknown',
        date: transaction.booking_date,
        amount,
        currency,
        category: transaction.category || 'uncategorised',
      });
    });

    // Sort items by date (newest first)
    Object.values(byCurrency).forEach(group => {
      group.items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    });

    return Object.values(byCurrency);
  };

  const currencyTotals = getReimbursableTransactions();

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

  const grandTotal = currencyTotals.reduce((sum, group) => sum + group.total, 0);

  if (currencyTotals.length === 0) {
    return (
      <div className={`bg-neutral-800/50 border border-neutral-700 rounded p-4 ${className}`}>
        <div className="text-sm text-neutral-400">No reimbursable transactions</div>
      </div>
    );
  }

  return (
    <div className={`bg-neutral-800/50 border border-neutral-700 rounded p-4 space-y-4 ${className}`}>
      <div>
        <h3 className="text-sm font-semibold text-white mb-1">Reimbursement Summary</h3>
        <div className="text-xs text-neutral-400">
          Total to reimburse: {formatCurrency(grandTotal, currencyTotals[0]?.currency || 'PLN')}
          {currencyTotals.length > 1 && ` (${currencyTotals.length} currencies)`}
        </div>
      </div>

      {currencyTotals.map(group => (
        <div key={group.currency} className="border-t border-neutral-700 pt-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-medium text-neutral-300">{group.currency}</div>
            <div className="text-lg font-semibold text-blue-400">
              {formatCurrency(group.total, group.currency)}
            </div>
          </div>

          <div className="space-y-1">
            {group.items.map(item => (
              <div
                key={item.id}
                className="flex items-center justify-between text-xs bg-neutral-900/50 rounded px-2 py-1"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-white truncate">{item.vendor}</div>
                  <div className="flex items-center gap-2 text-neutral-500 mt-0.5">
                    <span>{formatDate(item.date)}</span>
                    <span>•</span>
                    <span>{item.category}</span>
                  </div>
                </div>
                <div className="ml-2 text-neutral-300 font-medium">
                  {formatCurrency(item.amount, item.currency)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

