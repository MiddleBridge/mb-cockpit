import type { ProblemSeverityPl } from "../../../types/contractAnalysis";

export default function SeverityDot({
  severity,
}: {
  severity: ProblemSeverityPl;
}) {
  const color =
    severity === "duża"
      ? "bg-red-500"
      : severity === "średnia"
      ? "bg-amber-500"
      : "bg-emerald-500";

  return (
    <span
      className={`w-2 h-2 rounded-full ${color}`}
      title={`Severity: ${severity}`}
    />
  );
}


