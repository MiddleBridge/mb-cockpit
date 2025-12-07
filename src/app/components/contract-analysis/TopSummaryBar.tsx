import type { ContractSummary } from "../../../types/contractAnalysis";
import RiskBadge from "./RiskBadge";

export default function TopSummaryBar({
  summary,
}: {
  summary: ContractSummary;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border border-neutral-800 rounded-lg p-3 bg-neutral-900">
      {/* Risk badge */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-neutral-400">Overall risk</span>
        <RiskBadge level={summary.overall_risk_level} />
      </div>

      {/* Top actions */}
      <div className="flex-1 md:px-4">
        <div className="text-xs text-neutral-400 mb-1">Key actions now</div>
        {summary.top_actions && summary.top_actions.length > 0 ? (
          <ul className="list-disc list-inside text-xs text-neutral-100 space-y-0.5">
            {summary.top_actions.slice(0, 3).map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-neutral-500">No actions specified</p>
        )}
      </div>

      {/* Decision */}
      <div className="md:w-56">
        <div className="text-xs text-neutral-400 mb-1">Decision</div>
        <div className="text-xs text-neutral-100">
          {summary.recommended_strategy || "No strategy specified"}
        </div>
      </div>
    </div>
  );
}

