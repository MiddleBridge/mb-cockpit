'use client';

import { useEffect, useState } from 'react';
import { getMonthlyTrend, MonthlyTrendData } from '@/lib/finance/queries/getMonthlyTrend';
import { getTopCategories, TopCategory } from '@/lib/finance/queries/getTopCategories';

interface InsightsPanelProps {
  orgId: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  onMonthClick?: (month: string) => void;
  onCategoryClick?: (category: string) => void;
}

export default function InsightsPanel({
  orgId,
  dateFrom,
  dateTo,
  onMonthClick,
  onCategoryClick,
}: InsightsPanelProps) {
  const [trendData, setTrendData] = useState<MonthlyTrendData[]>([]);
  const [topCategories, setTopCategories] = useState<TopCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInsights();
  }, [orgId, dateFrom, dateTo]);

  const loadInsights = async () => {
    setLoading(true);
    try {
      const [trend, categories] = await Promise.all([
        getMonthlyTrend({ orgId }),
        getTopCategories({ orgId, dateFrom, dateTo }),
      ]);
      setTrendData(trend);
      setTopCategories(categories);
    } catch (error) {
      console.error('Error loading insights:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatMonth = (month: string) => {
    const [year, monthNum] = month.split('-');
    const date = new Date(parseInt(year), parseInt(monthNum) - 1);
    return date.toLocaleDateString('pl-PL', { month: 'short', year: 'numeric' });
  };

  // Calculate max for chart scaling
  const maxAmount = Math.max(
    ...trendData.map(d => Math.max(Math.abs(d.inflow), Math.abs(d.outflow), Math.abs(d.net)))
  );

  return (
    <div className="space-y-4">
      {/* Monthly Trend */}
      <div className="bg-neutral-800 rounded-lg p-4 border border-neutral-700">
        <h3 className="text-xs font-semibold text-white mb-3">Trend miesięczny</h3>
        {loading ? (
          <div className="text-xs text-neutral-400">Ładowanie...</div>
        ) : trendData.length === 0 ? (
          <div className="text-xs text-neutral-400">Brak danych</div>
        ) : (
          <div className="space-y-2">
            {trendData.slice(-6).reverse().map((month) => (
              <div
                key={month.month}
                onClick={() => onMonthClick?.(month.month)}
                className={`p-2 rounded cursor-pointer hover:bg-neutral-700/50 ${
                  onMonthClick ? '' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs text-neutral-300">{formatMonth(month.month)}</div>
                  <div className={`text-xs font-medium ${
                    month.net >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {formatCurrency(month.net)}
                  </div>
                </div>
                <div className="flex items-center gap-1 h-4">
                  {month.inflow > 0 && (
                    <div 
                      className="bg-green-500/30 rounded-l"
                      style={{ width: `${(month.inflow / maxAmount) * 100}%`, height: '100%' }}
                      title={`Przychód: ${formatCurrency(month.inflow)}`}
                    />
                  )}
                  {month.outflow > 0 && (
                    <div className="flex-1 flex items-stretch" style={{ width: `${(month.outflow / maxAmount) * 100}%` }}>
                      {/* VAT */}
                      {month.taxes && month.taxes.vat > 0 && (
                        <div
                          className="bg-red-600/50"
                          style={{ width: `${(month.taxes.vat / month.outflow) * 100}%` }}
                          title={`VAT: ${formatCurrency(month.taxes.vat)}`}
                        />
                      )}
                      {/* CIT */}
                      {month.taxes && month.taxes.cit > 0 && (
                        <div
                          className="bg-red-700/50"
                          style={{ width: `${(month.taxes.cit / month.outflow) * 100}%` }}
                          title={`CIT: ${formatCurrency(month.taxes.cit)}`}
                        />
                      )}
                      {/* Other taxes */}
                      {month.taxes && month.taxes.other > 0 && (
                        <div
                          className="bg-red-800/50"
                          style={{ width: `${(month.taxes.other / month.outflow) * 100}%` }}
                          title={`Inne podatki: ${formatCurrency(month.taxes.other)}`}
                        />
                      )}
                      {/* Non-tax expenses */}
                      {(month.outflow - (month.taxes?.vat || 0) - (month.taxes?.cit || 0) - (month.taxes?.other || 0)) > 0 && (
                        <div
                          className="bg-red-500/30 rounded-r"
                          style={{ 
                            width: `${((month.outflow - (month.taxes?.vat || 0) - (month.taxes?.cit || 0) - (month.taxes?.other || 0)) / month.outflow) * 100}%` 
                          }}
                          title={`Inne wydatki: ${formatCurrency(month.outflow - (month.taxes?.vat || 0) - (month.taxes?.cit || 0) - (month.taxes?.other || 0))}`}
                        />
                      )}
                    </div>
                  )}
                </div>
                {/* Tax breakdown tooltip */}
                {month.taxes && (month.taxes.vat > 0 || month.taxes.cit > 0 || month.taxes.other > 0) && (
                  <div className="text-xs text-neutral-500 mt-0.5">
                    Podatki: {month.taxes.vat > 0 && `VAT ${formatCurrency(month.taxes.vat)}`}
                    {month.taxes.vat > 0 && (month.taxes.cit > 0 || month.taxes.other > 0) && ', '}
                    {month.taxes.cit > 0 && `CIT ${formatCurrency(month.taxes.cit)}`}
                    {month.taxes.cit > 0 && month.taxes.other > 0 && ', '}
                    {month.taxes.other > 0 && `Inne ${formatCurrency(month.taxes.other)}`}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top Categories */}
      <div className="bg-neutral-800 rounded-lg p-4 border border-neutral-700">
        <h3 className="text-xs font-semibold text-white mb-3">Top kategorie</h3>
        {loading ? (
          <div className="text-xs text-neutral-400">Ładowanie...</div>
        ) : topCategories.length === 0 ? (
          <div className="text-xs text-neutral-400">Brak danych</div>
        ) : (
          <div className="space-y-1">
            {topCategories.map((cat) => (
              <div
                key={cat.category}
                onClick={() => onCategoryClick?.(cat.category)}
                className={`flex items-center justify-between p-2 rounded hover:bg-neutral-700/50 ${
                  onCategoryClick ? 'cursor-pointer' : ''
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white truncate">{cat.category}</div>
                  <div className="text-xs text-neutral-400">{cat.transaction_count} transakcji</div>
                </div>
                <div className="text-xs font-medium text-neutral-300 ml-2">
                  {formatCurrency(cat.total_amount)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

