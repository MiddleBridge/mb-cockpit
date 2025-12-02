"use client";

import type { ViewMode } from "../hooks/useViewMode";

interface ViewModeToggleProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export default function ViewModeToggle({ viewMode, onViewModeChange }: ViewModeToggleProps) {
  return (
    <div className="flex items-center gap-1 p-0.5 bg-neutral-800 rounded border border-neutral-700">
      <button
        onClick={() => onViewModeChange("compact")}
        className={`px-2 py-1 text-xs rounded transition-colors ${
          viewMode === "compact"
            ? "bg-white text-black"
            : "text-neutral-400 hover:text-white"
        }`}
        title="Compact view"
      >
        ≡
      </button>
      <button
        onClick={() => onViewModeChange("list")}
        className={`px-2 py-1 text-xs rounded transition-colors ${
          viewMode === "list"
            ? "bg-white text-black"
            : "text-neutral-400 hover:text-white"
        }`}
        title="List view"
      >
        ☰
      </button>
      <button
        onClick={() => onViewModeChange("grid")}
        className={`px-2 py-1 text-xs rounded transition-colors ${
          viewMode === "grid"
            ? "bg-white text-black"
            : "text-neutral-400 hover:text-white"
        }`}
        title="Grid view"
      >
        ⊞
      </button>
    </div>
  );
}


