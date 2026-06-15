// Runner: read properties lacking an underwrite, run the pure math, write one
// `underwrites` row each. Talks to other services only through Postgres (§7.4).
// The DB client is injected so this stays unit-testable and provider-agnostic.
import type { Property, UnderwriteInsert } from "@parcel/types";
import { underwrite } from "./underwrite.js";
import { estimateInputs } from "./estimate.js";

export interface UnderwriteStore {
  /** Properties with no `underwrites` row yet. */
  propertiesNeedingUnderwrite(): Promise<Property[]>;
  insertUnderwrite(row: UnderwriteInsert): Promise<void>;
}

export interface RunOptions {
  rulePct?: number;
  feeTarget?: number;
}

/** Underwrite every un-underwritten property. Returns a verdict tally. */
export async function runUnderwriting(
  store: UnderwriteStore,
  opts: RunOptions = {},
): Promise<{ clear: number; thin: number; pass: number }> {
  const tally = { clear: 0, thin: 0, pass: 0 };
  const properties = await store.propertiesNeedingUnderwrite();

  for (const p of properties) {
    const inputs = estimateInputs(p);
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
      verdict: r.verdict,
    });

    tally[r.verdict] += 1;
  }

  return tally;
}
