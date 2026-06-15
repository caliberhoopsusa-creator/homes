// Distress-signal normalization: coerce free-form provider tags onto the shared
// DistressSignal enum, dedupe, and drop anything unrecognized.
import type { DistressSignal } from "@parcel/types";
import { distressSignal } from "@parcel/types";

// Common provider aliases → canonical enum value.
const ALIASES: Record<string, DistressSignal> = {
  tax_delinquent: "tax_delinquent",
  "tax-delinquent": "tax_delinquent",
  taxdelinquent: "tax_delinquent",
  delinquent: "tax_delinquent",
  preforeclosure: "preforeclosure",
  "pre-foreclosure": "preforeclosure",
  pre_foreclosure: "preforeclosure",
  foreclosure: "preforeclosure",
  vacant: "vacant",
  vacancy: "vacant",
  absentee: "absentee",
  absentee_owner: "absentee",
  absenteeowner: "absentee",
  "out-of-state": "absentee",
};

/** Normalize raw tags into a deduped array of valid DistressSignal values. */
export function normalizeDistress(raw: ReadonlyArray<string>): DistressSignal[] {
  const out = new Set<DistressSignal>();
  for (const tag of raw) {
    const key = tag.trim().toLowerCase();
    const mapped = ALIASES[key];
    if (mapped) {
      out.add(mapped);
      continue;
    }
    // Fall back to the enum itself in case a provider already emits canonical.
    const parsed = distressSignal.safeParse(key);
    if (parsed.success) out.add(parsed.data);
  }
  return [...out];
}
