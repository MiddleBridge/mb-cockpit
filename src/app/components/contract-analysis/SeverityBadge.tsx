import type { ProblemSeverityPl } from "../../../types/contractAnalysis";

export default function SeverityBadge({
  severity,
}: {
  severity: ProblemSeverityPl;
}) {
  const map = {
    "duża": "bg-red-100 text-red-700 border border-red-300",
    "średnia": "bg-amber-100 text-amber-700 border border-amber-300",
    "mała": "bg-emerald-100 text-emerald-700 border border-emerald-300",
  } as const;

  const label =
    severity === "duża"
      ? "High impact"
      : severity === "średnia"
      ? "Medium impact"
      : "Low impact";

  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${map[severity]}`}
    >
      {label}
    </span>
  );
}


