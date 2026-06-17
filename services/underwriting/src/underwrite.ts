// The 70% rule — the canonical wholesaler math. PURE: no external deps, no I/O.
// This is the single source of truth for the spread; the Parcel desk imports
// `underwrite()` from here so its spread bar can never drift from the engine.
import type { Verdict } from "@parcel/types";

export interface UnderwriteParams {
  /** After-repair value (provider AVM × heuristic until comps are wired). */
  arv: number;
  /** Estimated rehab cost. */
  repairs: number;
  /** Seller asking / our acquisition basis. */
  asking: number;
  /** Wholesaler rule. Default 0.70. */
  rulePct?: number;
  /** Assignment fee we want to clear. Default $10,000 (research-backed planning number). */
  feeTarget?: number;
  // ── Itemized-MAO inputs (Max Maxwell's full formula). Passing `buyerProfitPct`
  //    switches the engine from the 70% shortcut to the itemized model, where the
  //    buyer ceiling is ARV minus every cost the buyer carries. ──
  /** Buyer's holding cost over the rehab (taxes/insurance/utilities/financing). */
  holdingCosts?: number;
  /** Buyer's closing costs (both legs). */
  closingCosts?: number;
  /** Buyer's required profit as a fraction of ARV (his 0.15–0.20). Presence ⇒ itemized mode. */
  buyerProfitPct?: number;
}

export type UnderwriteMode = "rule70" | "itemized";

export interface UnderwriteResult {
  arv: number;
  repairs: number;
  asking: number;
  rulePct: number;
  feeTarget: number;
  /** Which formula produced the buyer ceiling. */
  mode: UnderwriteMode;
  /** What an end buyer can pay: rule70 → arv*rulePct - repairs; itemized → arv - repairs - holding - closing - arv*buyerProfitPct. */
  buyerCeiling: number;
  /** Our maximum allowable offer: buyerCeiling - feeTarget. */
  yourMao: number;
  /** The spread we'd capture at `asking`: buyerCeiling - asking. */
  feePotential: number;
  /** clear: feePotential ≥ feeTarget · thin: > 0 · pass: ≤ 0. */
  verdict: Verdict;
}

export const DEFAULT_RULE_PCT = 0.7;
// $10k is the prudent planning fee per the wholesaling research (docs/RESEARCH-wholesaling.md);
// the vendor-cited "$13k average" is inflated. $10k keeps "$10k/mo ≈ ~1 deal" conservative.
export const DEFAULT_FEE_TARGET = 10000;

/**
 * Run the 70% rule. Verdict thresholds (PRD §6.3):
 *   clear  — fee_potential ≥ fee_target  (worth working)
 *   thin   — fee_potential  > 0          (marginal)
 *   pass   — otherwise                   (no spread)
 */
export function underwrite(params: UnderwriteParams): UnderwriteResult {
  const {
    arv,
    repairs,
    asking,
    rulePct = DEFAULT_RULE_PCT,
    feeTarget = DEFAULT_FEE_TARGET,
    holdingCosts = 0,
    closingCosts = 0,
    buyerProfitPct,
  } = params;

  // Itemized mode is opt-in via buyerProfitPct; otherwise the canonical 70% rule.
  const mode: UnderwriteMode =
    buyerProfitPct !== undefined ? "itemized" : "rule70";

  const buyerCeiling =
    mode === "itemized"
      ? arv - repairs - holdingCosts - closingCosts - arv * (buyerProfitPct as number)
      : arv * rulePct - repairs;

  const yourMao = buyerCeiling - feeTarget;
  const feePotential = buyerCeiling - asking;

  let verdict: Verdict;
  if (feePotential >= feeTarget) verdict = "clear";
  else if (feePotential > 0) verdict = "thin";
  else verdict = "pass";

  return {
    arv,
    repairs,
    asking,
    rulePct,
    feeTarget,
    mode,
    buyerCeiling,
    yourMao,
    feePotential,
    verdict,
  };
}
