import type { DecisionFlag } from "../../../types/contractAnalysis";

export default function DecisionBadge({ flag }: { flag: DecisionFlag }) {
  const map = {
    MUST_CHANGE:
      "bg-red-900/40 text-red-200 border border-red-700/60",
    NICE_TO_HAVE:
      "bg-sky-900/40 text-sky-200 border border-sky-700/60",
    ONLY_NOTE: "bg-neutral-800 text-neutral-300 border border-neutral-700",
  } as const;

  const label =
    flag === "MUST_CHANGE"
      ? "Must change before signing"
      : flag === "NICE_TO_HAVE"
      ? "Nice to have"
      : "Only note";

  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${map[flag]}`}
    >
      {label}
    </span>
  );
}


