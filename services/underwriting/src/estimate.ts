// v1 ARV/repairs heuristic. Until a comps source is wired, ARV defaults to the
// provider AVM and repairs to a per-sqft heuristic scaled by distress. Every
// underwrite built from these is flagged `is_estimate = true` (PRD §6.3).
import type { Property } from "@parcel/types";

/** Rehab $/sqft assumption for a "needs work" distressed property. */
export const REPAIRS_PER_SQFT = 35;
/** Fallback sqft when the provider didn't return one. */
const FALLBACK_SQFT = 1400;

export interface EstimatedInputs {
  arv: number;
  repairs: number;
  asking: number;
  isEstimate: true;
}

/**
 * Derive underwriting inputs from a raw property when no comps/repair bid exists.
 * `asking` falls back to est_value when the property isn't actively listed.
 */
export function estimateInputs(p: Property): EstimatedInputs {
  const arv = p.est_value ?? 0;
  const sqft = p.sqft ?? FALLBACK_SQFT;
  const repairs = sqft * REPAIRS_PER_SQFT;
  const asking = p.asking ?? p.est_value ?? 0;
  return { arv, repairs, asking, isEstimate: true };
}
