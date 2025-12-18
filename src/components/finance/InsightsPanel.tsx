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
          <div className="space-y-1.5">
            {trendData.slice(-6).reverse().map((month) => (
              <div
                key={month.month}
                onClick={() => onMonthClick?.(month.month)}
                className={`p-1.5 rounded cursor-pointer hover:bg-neutral-700/50 ${
                  onMonthClick ? '' : ''
                }`}
              >
                {/* Compact single-row layout: Month | Income | Balance | Expenses */}
                <div className="flex items-center gap-2">
                  {/* Month label */}
                  <div className="text-xs text-neutral-400 min-w-[60px]">{formatMonth(month.month)}</div>
                  
                  {/* Income (green) */}
                  <div className="flex-1 h-5 bg-neutral-900 rounded relative overflow-hidden">
                    {month.inflow > 0 && (
                      <div 
                        className="bg-green-500 h-full rounded"
                        style={{ 
                          width: `${Math.min((month.inflow / maxAmount) * 100, 100)}%`
                        }}
                        title={`Przychód: ${formatCurrency(month.inflow)}`}
                      />
                    )}
                    <div className="absolute inset-0 flex items-center justify-start px-1">
                      <span className="text-[9px] font-medium text-white">
                        {formatCurrency(month.inflow)}
                      </span>
                    </div>
                  </div>

                  {/* Balance */}
                  <div className="flex-shrink-0 min-w-[70px] text-center">
                    <div className={`text-xs font-semibold ${
                      month.net >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {formatCurrency(month.net)}
                    </div>
                  </div>

                  {/* Expenses (red) with taxes on bar */}
                  <div className="flex-1 relative">
                    {month.outflow > 0 && (
                      <>
                        <div className="h-5 bg-neutral-900 rounded relative overflow-hidden">
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
                          <div className="absolute inset-0 flex items-center justify-end px-1 pointer-events-none">
                            <span className="text-[9px] font-medium text-red-400">
                              {formatCurrency(month.outflow)}
                            </span>
                          </div>
                        </div>
                        {/* Tax values below bar - always in one line */}
                        {((month.taxes?.vat ?? 0) > 0 || (month.taxes?.cit ?? 0) > 0 || (month.taxes?.other ?? 0) > 0) && (
                          <div className="mt-1 flex items-center justify-end gap-2 text-[8px] flex-wrap">
                            {month.taxes && month.taxes.vat > 0 && (
                              <span className="text-red-400 font-medium whitespace-nowrap">
                                VAT: {formatCurrency(month.taxes.vat)}
                              </span>
                            )}
                            {month.taxes && month.taxes.cit > 0 && (
                              <span className="text-red-500 font-medium whitespace-nowrap">
                                CIT: {formatCurrency(month.taxes.cit)}
                              </span>
                            )}
                            {month.taxes && month.taxes.other > 0 && (
                              <span className="text-red-600 font-medium whitespace-nowrap">
                                Inne: {formatCurrency(month.taxes.other)}
                              </span>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Legend */}
        {!loading && trendData.length > 0 && (
          <div className="mt-4 pt-2 border-t border-neutral-700">
            <div className="flex items-center gap-3 text-[9px] text-neutral-400 flex-wrap">
              <span className="font-medium text-neutral-300">Legenda:</span>
              {(() => {
                const allMonths = trendData.slice(-6).reverse();
                const totalOutflow = allMonths.reduce((sum, m) => sum + m.outflow, 0);
                const totalVAT = allMonths.reduce((sum, m) => sum + (m.taxes?.vat || 0), 0);
                const totalCIT = allMonths.reduce((sum, m) => sum + (m.taxes?.cit || 0), 0);
                const totalOther = allMonths.reduce((sum, m) => sum + (m.taxes?.other || 0), 0);
                
                return (
                  <>
                    {totalVAT > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="w-3 h-3 bg-red-600/60 rounded"></span>
                        <span>VAT 23% ({totalOutflow > 0 ? Math.round((totalVAT / totalOutflow) * 100) : 0}% kosztów)</span>
                      </span>
                    )}
                    {totalCIT > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="w-3 h-3 bg-red-700/60 rounded"></span>
                        <span>CIT 9% ({totalOutflow > 0 ? Math.round((totalCIT / totalOutflow) * 100) : 0}% kosztów)</span>
                      </span>
                    )}
                    {totalOther > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="w-3 h-3 bg-red-800/60 rounded"></span>
                        <span>Inne ({totalOutflow > 0 ? Math.round((totalOther / totalOutflow) * 100) : 0}% kosztów)</span>
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 bg-red-500/30 rounded"></span>
                      <span>Pozostałe ({totalOutflow > 0 ? Math.round(((totalOutflow - totalVAT - totalCIT - totalOther) / totalOutflow) * 100) : 0}% kosztów)</span>
                    </span>
                  </>
                );
              })()}
            </div>
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

