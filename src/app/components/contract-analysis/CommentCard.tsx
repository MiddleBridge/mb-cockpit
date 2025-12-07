"use client";

import { useState } from "react";
import type { ContractComment } from "../../../types/contractAnalysis";
import SeverityBadge from "./SeverityBadge";
import DecisionBadge from "./DecisionBadge";

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-[10px] text-neutral-400 font-medium">{children}</span>;
}

export default function CommentCard({ c }: { c: ContractComment }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-neutral-800 rounded-lg p-3 bg-neutral-950/60">
      {/* Header line */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300">
            {c.module} · {c.keyword}
          </span>
          {c.question_id && (
            <span className="text-[10px] text-neutral-500">Q{c.question_id}</span>
          )}
          <SeverityBadge severity={c.severity_pl} />
          {c.decision_flag && <DecisionBadge flag={c.decision_flag} />}
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-[10px] text-neutral-400 hover:text-neutral-100"
        >
          {expanded ? "Hide details" : "Show details"}
        </button>
      </div>

      {/* Short one-liner */}
      <div className="mt-2 text-xs text-neutral-100">
        {c.risk_short || c.suggested_change_summary}
      </div>

      {expanded && (
        <div className="mt-3 grid gap-3 md:grid-cols-2 border-t border-neutral-800 pt-3">
          <div className="space-y-2">
            <div>
              <Label>Co jest teraz</Label>
              <p className="text-[11px] text-neutral-300 mt-0.5">
                {c.current_text_summary}
              </p>
            </div>
            <div>
              <Label>Ryzyko</Label>
              <p className="text-[11px] text-neutral-300 mt-0.5">
                {c.risk_description}
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <div>
              <Label>Sugerowana zmiana</Label>
              <p className="text-[11px] text-neutral-300 mt-0.5">
                {c.suggested_change_summary}
              </p>
            </div>
            {c.example_clause_pl && (
              <div>
                <Label>Przykładowy zapis</Label>
                <pre className="text-[10px] bg-neutral-900 border border-neutral-800 rounded p-2 text-neutral-200 whitespace-pre-wrap mt-0.5">
                  {c.example_clause_pl}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


