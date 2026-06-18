// Runner: read properties lacking an underwrite, run the pure math, write one
// `underwrites` row each. Talks to other services only through Postgres (§7.4).
// The DB client is injected so this stays unit-testable and provider-agnostic.
import type { Property, UnderwriteInsert } from "@parcel/types";
import { underwrite } from "./underwrite.js";
import { estimateInputs } from "./estimate.js";
import { selectComps, estimateArvFromComps } from "./comps.js";
import { estimateRepairs, type ConditionTier } from "./repairs.js";
import type { CompsProvider } from "./comps-provider.js";

export interface UnderwriteStore {
  /** Properties with no `underwrites` row yet. */
  propertiesNeedingUnderwrite(): Promise<Property[]>;
  insertUnderwrite(row: UnderwriteInsert): Promise<void>;
}

export interface RunOptions {
  rulePct?: number;
  feeTarget?: number;
  /** When provided, ARV comes from real comps (Max's method) instead of the AVM heuristic. */
  compsProvider?: CompsProvider;
  /** Repair condition tier used with comps-backed ARV. Default 'medium'. */
  repairTier?: ConditionTier;
}

interface DerivedInputs {
  arv: number;
  repairs: number;
  asking: number;
  isEstimate: boolean;
  compCount: number;
}

/** Asking falls back to AVM when the property isn't actively listed. */
const askingOf = (p: Property): number => p.asking ?? p.est_value ?? 0;

/**
 * Derive ARV/repairs for one property: comps-backed when a provider yields usable
 * comps (is_estimate=false), else the AVM/per-sqft heuristic (is_estimate=true).
 */
async function deriveInputs(
  p: Property,
  opts: RunOptions,
): Promise<DerivedInputs> {
  if (opts.compsProvider) {
    const candidates = await opts.compsProvider.soldComps(p);
    const comps = selectComps(
      { lat: p.lat, lng: p.lng, sqft: p.sqft, beds: p.beds, garage: 1 },
      candidates,
    );
    if (comps.length > 0) {
      const { arv, compCount } = estimateArvFromComps(
        { lat: p.lat, lng: p.lng, sqft: p.sqft, beds: p.beds, garage: 1 },
        comps,
      );
      const repairs = estimateRepairs(p.sqft, opts.repairTier ?? "medium").total;
      return { arv, repairs, asking: askingOf(p), isEstimate: false, compCount };
    }
  }
  const e = estimateInputs(p);
  return { arv: e.arv, repairs: e.repairs, asking: e.asking, isEstimate: true, compCount: 0 };
}

/** Underwrite every un-underwritten property. Returns a verdict tally. */
export async function runUnderwriting(
  store: UnderwriteStore,
  opts: RunOptions = {},
): Promise<{ clear: number; thin: number; pass: number }> {
  const tally = { clear: 0, thin: 0, pass: 0 };
  const properties = await store.propertiesNeedingUnderwrite();

  for (const p of properties) {
    const inputs = await deriveInputs(p, opts);
    const r = underwrite({
      arv: inputs.arv,
      repairs: inputs.repairs,
      asking: inputs.asking,
      rulePct: opts.rulePct,
      feeTarget: opts.feeTarget,
    });

    await store.insertUnderwrite({
      property_id: p.id,
      arv: r.arv,
      repairs: r.repairs,
      rule_pct: r.rulePct,
      fee_target: r.feeTarget,
      buyer_ceiling: r.buyerCeiling,
      your_mao: r.yourMao,
      fee_potential: r.feePotential,
      is_estimate: inputs.isEstimate,
      comp_count: inputs.compCount,
      verdict: r.verdict,
    });

    tally[r.verdict] += 1;
  }

  return tally;
}
