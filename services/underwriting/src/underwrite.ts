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
  /** Assignment fee we want to clear. Default $12,000. */
  feeTarget?: number;
}

export interface UnderwriteResult {
  arv: number;
  repairs: number;
  asking: number;
  rulePct: number;
  feeTarget: number;
  /** What an end buyer can pay and still hit the rule: arv*rulePct - repairs. */
  buyerCeiling: number;
  /** Our maximum allowable offer: buyerCeiling - feeTarget. */
  yourMao: number;
  /** The spread we'd capture at `asking`: buyerCeiling - asking. */
  feePotential: number;
  /** clear: feePotential ≥ feeTarget · thin: > 0 · pass: ≤ 0. */
  verdict: Verdict;
}

export const DEFAULT_RULE_PCT = 0.7;
export const DEFAULT_FEE_TARGET = 12000;

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
  } = params;

  const buyerCeiling = arv * rulePct - repairs;
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
    buyerCeiling,
    yourMao,
    feePotential,
    verdict,
  };
}
