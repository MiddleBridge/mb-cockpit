"use client";

import { useState } from "react";

const STEPS = [
  "Zobacz overall risk i 3 główne działania",
  "Przejdź po punktach z flagą MUST CHANGE",
  "Sprawdź tabelę 'Current terms' dla czerwonych wierszy",
  "Zobacz 'After changes' żeby zobaczyć stan docelowy",
  "Zdecyduj: negocjuję / podpisuję / odrzucam",
];

export default function ActionStepsPanel() {
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const toggleStep = (index: number) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <div className="border border-neutral-800 rounded-lg p-3 bg-neutral-900">
      <h4 className="text-xs font-semibold text-white mb-3">
        Plan działania
      </h4>
      <div className="space-y-2">
        {STEPS.map((step, idx) => (
          <div
            key={idx}
            onClick={() => toggleStep(idx)}
            className="flex items-start gap-2 p-2 rounded border border-neutral-800 bg-neutral-950/60 cursor-pointer hover:bg-neutral-950 transition-colors"
          >
            <div className="flex-shrink-0 mt-0.5">
              {completedSteps.has(idx) ? (
                <span className="text-green-400 text-xs">✓</span>
              ) : (
                <span className="text-neutral-500 text-xs">{idx + 1}.</span>
              )}
            </div>
            <span
              className={`text-[11px] ${
                completedSteps.has(idx)
                  ? "text-neutral-400 line-through"
                  : "text-neutral-200"
              }`}
            >
              {step}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}


