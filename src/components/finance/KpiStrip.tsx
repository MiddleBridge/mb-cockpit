'use client';

interface KpiStripProps {
  inflow: number;
  outflow: number;
  net: number;
  uncategorisedCount: number;
  onUncategorisedClick?: () => void;
}

export default function KpiStrip({
  inflow,
  outflow,
  net,
  uncategorisedCount,
  onUncategorisedClick,
}: KpiStripProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="grid grid-cols-4 gap-4 px-4 py-3 bg-neutral-900 border-b border-neutral-800">
      <div className="bg-neutral-800 rounded p-2 border border-neutral-700">
        <div className="text-xs text-neutral-400 mb-1">Przychód</div>
        <div className="text-sm font-semibold text-green-400">{formatCurrency(inflow)}</div>
      </div>
      <div className="bg-neutral-800 rounded p-2 border border-neutral-700">
        <div className="text-xs text-neutral-400 mb-1">Wydatki</div>
        <div className="text-sm font-semibold text-red-400">{formatCurrency(outflow)}</div>
      </div>
      <div className="bg-neutral-800 rounded p-2 border border-neutral-700">
        <div className="text-xs text-neutral-400 mb-1">Saldo</div>
        <div className={`text-sm font-semibold ${net >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {formatCurrency(net)}
        </div>
      </div>
      <div 
        className={`bg-neutral-800 rounded p-2 border border-neutral-700 ${onUncategorisedClick ? 'cursor-pointer hover:bg-neutral-750' : ''}`}
        onClick={onUncategorisedClick}
      >
        <div className="text-xs text-neutral-400 mb-1">Nieskategoryzowane</div>
        <div className="text-sm font-semibold text-yellow-400">{uncategorisedCount}</div>
      </div>
    </div>
  );
}

