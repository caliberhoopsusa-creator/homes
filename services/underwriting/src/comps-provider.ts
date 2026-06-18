// Sold-comps data seam. The comps math (comps.ts) is pure; this interface is how
// the runner *gets* candidate sold properties. Mock default (deterministic,
// keyless); a real county sold-records / data-vendor impl slots in behind it
// later — same pattern as the sourcing/outreach providers (§9, no secrets here).
import type { Property } from "@parcel/types";
import type { SoldComp } from "./comps.js";

export interface CompsProvider {
  /** Candidate recently-sold properties to compare against the subject. */
  soldComps(property: Property): Promise<SoldComp[]>;
}

/** Days back from now, kept inside the default recency window. */
const RECENT_DAYS = [18, 41, 73, 96];
/** Price/sqft variation around the subject so the averaged ARV isn't degenerate. */
const VARIATION = [-0.06, -0.02, 0.03, 0.07];

/**
 * Deterministic mock: emits four nearby, recent, similar sold comps derived from
 * the subject (price varied around its AVM). Lets the comps→ARV pipeline run
 * end-to-end with no external data source. Returns [] when the subject lacks the
 * geo/sqft needed to compare.
 */
export class MockCompsProvider implements CompsProvider {
  async soldComps(p: Property): Promise<SoldComp[]> {
    if (p.lat == null || p.lng == null || p.sqft == null) return [];
    const base = p.est_value ?? 0;
    if (base <= 0) return [];
    const now = Date.now();
    return VARIATION.map((d, i) => ({
      id: `${p.id}-comp-${i}`,
      lat: p.lat! + (i - 1.5) * 0.002, // all within ~0.5 mi
      lng: p.lng! + (i - 1.5) * 0.002,
      sqft: Math.round(p.sqft! * (1 + d * 0.4)), // within sqft tolerance
      beds: p.beds,
      garage: 1,
      salePrice: Math.round(base * (1 + d)),
      soldDate: new Date(now - RECENT_DAYS[i]! * 86_400_000).toISOString(),
    }));
  }
}
