import type { RiskLevel } from "../../../types/contractAnalysis";

export default function RiskBadge({ level }: { level: RiskLevel }) {
  const map = {
    HIGH: "bg-red-100 text-red-700 border border-red-300",
    MEDIUM: "bg-amber-100 text-amber-700 border border-amber-300",
    LOW: "bg-emerald-100 text-emerald-700 border border-emerald-300",
  } as const;

  const label =
    level === "HIGH"
      ? "High risk"
      : level === "MEDIUM"
      ? "Medium risk"
      : "Low risk";

  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[level]}`}
    >
      {label}
    </span>
  );
}


