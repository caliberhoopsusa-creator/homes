// Lead motivation scoring + list-stacking (the Wholesaling Bible "Free Data
// Warfare" idea): a property that shows up on MORE distress lists is a MORE
// motivated seller. Score 0–100 so the desk surfaces the hottest leads first and
// you spend skip-trace dollars only where they pay off. PURE (no I/O) — tested
// in isolation and reused by the leads view.
import type { DistressSignal } from "@parcel/types";

export type LeadTier = "hot" | "warm" | "cold";

export interface LeadScoreInput {
  /** Distress lists this property appears on (deduped upstream). */
  signals: ReadonlyArray<DistressSignal>;
  /** Your estimated assignment fee for this deal, if underwritten. */
  feePotential?: number | null;
  /** Most you should pay (MAO) — used to sanity-check there's real spread. */
  mao?: number | null;
}

export interface LeadScore {
  /** 0–100. Higher = more motivated seller / better spread = work first. */
  score: number;
  tier: LeadTier;
  /** How many distress lists this property stacked onto. */
  signalCount: number;
  /** Plain-English drivers behind the score (for the UI tooltip). */
  reasons: string[];
}

// Motivation weight per signal. Deadline-driven distress (foreclosure, tax,
// probate) outranks the saturated "absentee" list the Bible warns about.
const SIGNAL_WEIGHT: Record<DistressSignal, number> = {
  preforeclosure: 25,
  probate: 22,
  tax_delinquent: 20,
  divorce: 18,
  vacant: 16,
  inherited: 16,
  eviction: 15,
  lien: 14,
  water_shutoff: 12,
  code_violation: 12,
  absentee: 8,
};

// Plain-English label + why-it-matters, shown to a beginner.
const SIGNAL_REASON: Record<DistressSignal, string> = {
  preforeclosure: "Facing foreclosure — hard deadline to sell",
  probate: "Probate — heirs often want a fast, clean sale",
  tax_delinquent: "Behind on property taxes",
  divorce: "Divorce — motivated to split and move on",
  vacant: "Vacant — owner carrying an empty house",
  inherited: "Inherited — heirs rarely want to keep it",
  eviction: "Dealing with an eviction — tired landlord",
  lien: "Has a lien/judgment against the property",
  water_shutoff: "Utilities shut off — likely vacant/distressed",
  code_violation: "Code violations — costly to fix, easy to sell",
  absentee: "Out-of-area owner",
};

const STACK_BONUS = 10; // per extra list, rewards multi-list "stacked" leads
const MAX_MOTIVATION = 70; // distress can contribute up to 70 of 100
const MAX_SPREAD = 30; // the deal's spread contributes up to 30 of 100
const FEE_TARGET = 10_000; // a full-target fee maxes out the spread portion
const HOT = 60;
const WARM = 35;

const tierFor = (score: number): LeadTier =>
  score >= HOT ? "hot" : score >= WARM ? "warm" : "cold";

/**
 * Score one lead. Distress signals drive motivation (up to 70), the underwritten
 * spread drives the rest (up to 30). Multi-list "stacked" leads get a bonus —
 * the core cheap-lead insight: overlap = motivation.
 */
export function scoreLead(input: LeadScoreInput): LeadScore {
  // Dedupe defensively so a repeated tag can't inflate the score.
  const signals = [...new Set(input.signals)];
  const reasons: string[] = [];

  const base = signals.reduce((sum, s) => sum + (SIGNAL_WEIGHT[s] ?? 0), 0);
  const stackBonus = Math.max(0, signals.length - 1) * STACK_BONUS;
  const motivation = Math.min(MAX_MOTIVATION, base + stackBonus);

  // Sort drivers strongest-first for the tooltip.
  for (const s of [...signals].sort(
    (a, b) => (SIGNAL_WEIGHT[b] ?? 0) - (SIGNAL_WEIGHT[a] ?? 0),
  )) {
    reasons.push(SIGNAL_REASON[s] ?? s.replace(/_/g, " "));
  }
  if (signals.length >= 2) {
    reasons.unshift(
      `On ${signals.length} distress lists — stacked leads are the most motivated`,
    );
  }

  const fee = input.feePotential ?? 0;
  const spread =
    fee > 0 ? Math.min(MAX_SPREAD, (fee / FEE_TARGET) * MAX_SPREAD) : 0;
  if (fee > 0) {
    reasons.push(`Estimated spread of ~$${Math.round(fee).toLocaleString()}`);
  }

  const score = Math.round(Math.min(100, motivation + spread));
  return { score, tier: tierFor(score), signalCount: signals.length, reasons };
}
