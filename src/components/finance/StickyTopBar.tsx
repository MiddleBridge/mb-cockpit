'use client';

import { useState, useEffect } from 'react';
import { useOrganisations } from '@/app/hooks/useSharedLists';

interface StickyTopBarProps {
  onSearchChange: (search: string) => void;
  onDateRangeChange: (from: string | null, to: string | null) => void;
  onOrgChange: (orgId: string | null) => void;
  onClearFilters: () => void;
  onUpload: (file: File) => Promise<void>;
  importStatus: 'idle' | 'importing' | 'complete' | 'failed';
  searchValue: string;
  dateFrom: string | null;
  dateTo: string | null;
  selectedOrgId: string | null;
}

export default function StickyTopBar({
  onSearchChange,
  onDateRangeChange,
  onOrgChange,
  onClearFilters,
  onUpload,
  importStatus,
  searchValue,
  dateFrom,
  dateTo,
  selectedOrgId,
}: StickyTopBarProps) {
  const { organisations } = useOrganisations();
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handlePreset = (preset: 'this_month' | 'last_30' | 'custom') => {
    const today = new Date();
    let from: string | null = null;
    let to: string | null = today.toISOString().substring(0, 10);

    if (preset === 'this_month') {
      from = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().substring(0, 10);
    } else if (preset === 'last_30') {
      const last30 = new Date(today);
      last30.setDate(last30.getDate() - 30);
      from = last30.toISOString().substring(0, 10);
    } else {
      setShowDatePicker(true);
      return;
    }

    onDateRangeChange(from, to);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
    }
  };

  return (
    <div className="sticky top-0 z-40 bg-neutral-900 border-b border-neutral-800 px-4 py-3">
      <div className="flex items-center gap-4 flex-wrap">
        {/* Date Range */}
        <div className="flex items-center gap-2">
          <select
            onChange={(e) => handlePreset(e.target.value as any)}
            className="text-xs bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-neutral-300"
            defaultValue=""
          >
            <option value="">Zakres dat</option>
            <option value="this_month">Ten miesiąc</option>
            <option value="last_30">Ostatnie 30 dni</option>
            <option value="custom">Niestandardowy</option>
          </select>
          {showDatePicker && (
            <>
              <input
                type="date"
                value={dateFrom || ''}
                onChange={(e) => onDateRangeChange(e.target.value || null, dateTo)}
                className="text-xs bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-neutral-300"
              />
              <span className="text-xs text-neutral-400">-</span>
              <input
                type="date"
                value={dateTo || ''}
                onChange={(e) => onDateRangeChange(dateFrom, e.target.value || null)}
                className="text-xs bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-neutral-300"
              />
            </>
          )}
        </div>

        {/* Org Selector */}
        <select
          value={selectedOrgId || ''}
          onChange={(e) => onOrgChange(e.target.value || null)}
          className="text-xs bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-neutral-300"
        >
          <option value="">Wszystkie organizacje</option>
          {organisations.map(org => (
            <option key={org.id} value={org.id}>{org.name}</option>
          ))}
        </select>

        {/* Search */}
        <input
          type="text"
          placeholder="Szukaj..."
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="flex-1 min-w-[200px] text-xs bg-neutral-800 border border-neutral-700 rounded px-3 py-1 text-neutral-300 placeholder-neutral-500"
        />

        {/* Clear Filters Button */}
        {(dateFrom || dateTo || searchValue) && (
          <button
            onClick={onClearFilters}
            className="text-xs bg-neutral-700 hover:bg-neutral-600 text-white px-3 py-1 rounded"
          >
            Wyczyść filtry
          </button>
        )}

        {/* Upload Button */}
        <label className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded cursor-pointer">
          📄 Wrzuć wyciąg
          <input
            type="file"
            accept=".csv,.txt"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>

        {/* Import Status */}
        {importStatus !== 'idle' && (
          <div className={`text-xs px-2 py-1 rounded ${
            importStatus === 'importing' ? 'bg-yellow-900/30 text-yellow-400' :
            importStatus === 'complete' ? 'bg-green-900/30 text-green-400' :
            'bg-red-900/30 text-red-400'
          }`}>
            {importStatus === 'importing' ? 'Importowanie...' :
             importStatus === 'complete' ? 'Zaimportowano' :
             'Błąd importu'}
          </div>
        )}
      </div>
    </div>
  );
}

