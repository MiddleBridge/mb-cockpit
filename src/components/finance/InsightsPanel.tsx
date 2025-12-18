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

  // Calculate max for chart scaling (use max of inflow or outflow)
  const maxAmount = Math.max(
    ...trendData.map(d => Math.max(d.inflow, d.outflow)),
    1 // Avoid division by zero
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
          <div className="space-y-3">
            {trendData.slice(-6).reverse().map((month) => (
              <div
                key={month.month}
                onClick={() => onMonthClick?.(month.month)}
                className={`p-2 rounded cursor-pointer hover:bg-neutral-700/50 ${
                  onMonthClick ? '' : ''
                }`}
              >
                {/* Month label */}
                <div className="text-xs text-neutral-400 mb-2">{formatMonth(month.month)}</div>
                
                {/* Three-column layout: Income | Balance | Expenses */}
                <div className="flex items-center gap-2">
                  {/* Left: Income (green) */}
                  <div className="flex-1 flex flex-col items-start">
                    <div className="text-[10px] text-neutral-500 mb-1">Przychód</div>
                    <div className="w-full h-6 bg-neutral-900 rounded relative overflow-hidden">
                      {month.inflow > 0 && (
                        <div 
                          className="bg-green-500 h-full rounded"
                          style={{ 
                            width: `${Math.min((month.inflow / maxAmount) * 100, 100)}%`
                          }}
                          title={`Przychód: ${formatCurrency(month.inflow)}`}
                        />
                      )}
                      <div className="absolute inset-0 flex items-center justify-start px-1.5">
                        <span className="text-[10px] font-medium text-green-400">
                          {formatCurrency(month.inflow)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Center: Balance */}
                  <div className="flex-shrink-0 flex flex-col items-center min-w-[80px]">
                    <div className="text-[10px] text-neutral-500 mb-1">Bilans</div>
                    <div className={`text-sm font-semibold ${
                      month.net >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {formatCurrency(month.net)}
                    </div>
                  </div>

                  {/* Right: Expenses (red) */}
                  <div className="flex-1 flex flex-col items-end">
                    <div className="text-[10px] text-neutral-500 mb-1">Koszty</div>
                    <div className="w-full h-6 bg-neutral-900 rounded relative overflow-hidden">
                      {month.outflow > 0 && (
                        <div className="flex items-stretch h-full justify-end">
                          {/* VAT - darker red */}
                          {month.taxes && month.taxes.vat > 0 && (
                            <div
                              className="bg-red-600/60"
                              style={{ width: `${(month.taxes.vat / month.outflow) * 100}%` }}
                              title={`VAT: ${formatCurrency(month.taxes.vat)}`}
                            />
                          )}
                          {/* CIT - even darker red */}
                          {month.taxes && month.taxes.cit > 0 && (
                            <div
                              className="bg-red-700/60"
                              style={{ width: `${(month.taxes.cit / month.outflow) * 100}%` }}
                              title={`CIT: ${formatCurrency(month.taxes.cit)}`}
                            />
                          )}
                          {/* Other taxes - darkest red */}
                          {month.taxes && month.taxes.other > 0 && (
                            <div
                              className="bg-red-800/60"
                              style={{ width: `${(month.taxes.other / month.outflow) * 100}%` }}
                              title={`Inne podatki: ${formatCurrency(month.taxes.other)}`}
                            />
                          )}
                          {/* Remaining non-tax expenses - lighter red */}
                          {(() => {
                            const totalTaxes = (month.taxes?.vat || 0) + (month.taxes?.cit || 0) + (month.taxes?.other || 0);
                            const remaining = month.outflow - totalTaxes;
                            return remaining > 0 ? (
                              <div
                                className="bg-red-500/30 rounded-r"
                                style={{ width: `${(remaining / month.outflow) * 100}%` }}
                                title={`Pozostałe wydatki: ${formatCurrency(remaining)}`}
                              />
                            ) : null;
                          })()}
                        </div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-end px-1.5">
                        <span className="text-[10px] font-medium text-red-400">
                          {formatCurrency(month.outflow)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tax breakdown tooltip */}
                {month.taxes && (month.taxes.vat > 0 || month.taxes.cit > 0 || month.taxes.other > 0) && (
                  <div className="text-xs text-neutral-500 mt-1.5 text-center">
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

