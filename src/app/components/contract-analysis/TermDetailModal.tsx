"use client";

import type { ContractTermEntry } from "../../../types/contractAnalysis";

interface TermDetailModalProps {
  term: ContractTermEntry | null;
  onClose: () => void;
}

export default function TermDetailModal({
  term,
  onClose,
}: TermDetailModalProps) {
  if (!term) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white font-mono">
            {term.keyword}
          </h3>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white text-xl"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[10px] text-neutral-400 font-medium">
              What is agreed
            </label>
            <p className="text-xs text-neutral-200 mt-1">
              {term.what_is_agreed}
            </p>
          </div>

          <div>
            <label className="text-[10px] text-neutral-400 font-medium">
              What I must do
            </label>
            <p className="text-xs text-neutral-200 mt-1">
              {term.what_i_must_do}
            </p>
          </div>

          <div>
            <label className="text-[10px] text-neutral-400 font-medium">
              If done
            </label>
            <p className="text-xs text-neutral-200 mt-1">{term.if_done}</p>
          </div>

          <div>
            <label className="text-[10px] text-neutral-400 font-medium">
              If not done
            </label>
            <p className="text-xs text-neutral-200 mt-1">{term.if_not_done}</p>
          </div>

          {term.where_in_contract && (
            <div>
              <label className="text-[10px] text-neutral-400 font-medium">
                Where in contract
              </label>
              <p className="text-xs text-neutral-300 mt-1">
                {term.where_in_contract}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


