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
  // Free public-record lists (Wholesaling Bible "Free Data Engine" sources).
  code_violation: "code_violation",
  "code-violation": "code_violation",
  codeviolation: "code_violation",
  code_enforcement: "code_violation",
  violation: "code_violation",
  probate: "probate",
  "probate-filing": "probate",
  estate: "probate",
  eviction: "eviction",
  evictions: "eviction",
  "unlawful-detainer": "eviction",
  lien: "lien",
  liens: "lien",
  "mechanics-lien": "lien",
  judgment: "lien",
  water_shutoff: "water_shutoff",
  "water-shutoff": "water_shutoff",
  watershutoff: "water_shutoff",
  utility_shutoff: "water_shutoff",
  divorce: "divorce",
  divorces: "divorce",
  inherited: "inherited",
  inheritance: "inherited",
  heir: "inherited",
  heirs: "inherited",
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
