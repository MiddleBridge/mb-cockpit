"use client";

import { useSearchParams } from "next/navigation";

export default function SegmentDetails() {
  const searchParams = useSearchParams();
  const dimension = searchParams.get("dimension");
  const segment = searchParams.get("segment");

  if (!dimension || !segment) {
    return null;
  }

  return (
    <div className="mb-4 border-b border-neutral-800 pb-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">{segment}</h2>
          <p className="text-sm text-neutral-500 mt-1">{dimension}</p>
        </div>
        <a
          href="/"
          className="text-xs text-neutral-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-neutral-800"
        >
          × Close
        </a>
      </div>
    </div>
  );
}

