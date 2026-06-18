import type { LeadScore, LeadTier } from "@/lib/scoring";

const TIER_CLASS: Record<LeadTier, string> = {
  hot: "bg-red-100 text-red-700 border-red-300",
  warm: "bg-amber-100 text-amber-800 border-amber-300",
  cold: "bg-slate-100 text-slate-500 border-slate-200",
};

const TIER_LABEL: Record<LeadTier, string> = {
  hot: "Hot",
  warm: "Warm",
  cold: "Cold",
};

type Props = { score: LeadScore };

/**
 * Compact motivation chip for a lead. Hover shows the drivers so a beginner
 * understands *why* a lead is worth working first.
 */
export function LeadScoreBadge({ score }: Props) {
  const title = score.reasons.length
    ? score.reasons.join(" · ")
    : "No distress signals yet";
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${TIER_CLASS[score.tier]}`}
    >
      {TIER_LABEL[score.tier]}
      <span className="tabular-nums opacity-70">{score.score}</span>
    </span>
  );
}
