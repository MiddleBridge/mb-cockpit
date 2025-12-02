"use client";

import { useState, useEffect } from "react";

export type ViewMode = "compact" | "list" | "grid";

export function useViewMode(storageKey: string): [ViewMode, (mode: ViewMode) => void] {
  // Always start with default value to avoid hydration mismatch
  const [viewMode, setViewModeState] = useState<ViewMode>("compact");
  const [isMounted, setIsMounted] = useState(false);

  // Load from localStorage only after component mounts (client-side only)
  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`viewMode_${storageKey}`);
      if (saved === "compact" || saved === "list" || saved === "grid") {
        setViewModeState(saved);
      }
    }
  }, [storageKey]);

  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem(`viewMode_${storageKey}`, mode);
    }
  };

  return [viewMode, setViewMode];
}

