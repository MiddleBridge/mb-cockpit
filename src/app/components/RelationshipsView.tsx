"use client";

import { useState } from "react";

export default function RelationshipsView() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Relationships</h2>
        </div>
      </div>

      <div className="border border-neutral-800 rounded-lg p-6 bg-neutral-900">
        <div className="text-center text-neutral-400">
          <div className="text-2xl mb-2">🔗</div>
          <div className="text-sm">Relationships content will be displayed here</div>
        </div>
      </div>
    </div>
  );
}




