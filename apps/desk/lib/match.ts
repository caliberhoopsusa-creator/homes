// Pure buyer-matching. Scores a buyer's buy-box against a deal's facts +
// underwrite. No I/O, no deps beyond shared types — mirrors the engine's
// "pure math" discipline so matching is testable and never drifts.
import type { Buyer, Property } from "@parcel/types";
import type { UnderwriteResult } from "@parcel/underwriting";

// The deal context a buyer is scored against. We use the underwrite's
// buyer_ceiling as the effective price (what a buyer can pay and still hit
// the rule) and repairs to test the buyer's rehab tolerance.
export interface MatchInput {
  property: Pick<Property, "beds" | "city" | "state">;
  /** Price the buyer would pay — defaults to underwrite buyer ceiling. */
  price: number;
  repairs: number;
}

export interface MatchResult {
  score: number; // 0..1
  qualifies: boolean;
  reasons: string[];
}

const norm = (s: string | null | undefined): string =>
  (s ?? "").trim().toLowerCase();

/**
 * Score a buyer against a deal. `qualifies` is true only when every hard
 * constraint passes (price band, min beds, area, max repairs). `score` is a
 * 0..1 soft rank: it rewards a center-of-band price and headroom on repairs,
 * so qualifying buyers are orderable even when several all "fit".
 */
export function matchScore(deal: MatchInput, buyer: Buyer): MatchResult {
  const reasons: string[] = [];
  let ok = true;

  // ── price band ──
  const min = buyer.min_price ?? 0;
  const max = buyer.max_price ?? Number.POSITIVE_INFINITY;
  const priceOk = deal.price >= min && deal.price <= max;
  if (!priceOk) {
    ok = false;
    reasons.push(
      deal.price < min ? "below buyer min price" : "above buyer max price",
    );
  }

  // ── min beds ──
  const beds = deal.property.beds ?? 0;
  const bedsOk = beds >= (buyer.min_beds ?? 0);
  if (!bedsOk) {
    ok = false;
    reasons.push("fewer beds than buy-box");
  }

  // ── area (match on city or state, case-insensitive) ──
  const areas = (buyer.areas ?? []).map(norm).filter(Boolean);
  const areaOk =
    areas.length === 0 ||
    areas.includes(norm(deal.property.city)) ||
    areas.includes(norm(deal.property.state));
  if (!areaOk) {
    ok = false;
    reasons.push("outside buyer areas");
  }

  // ── max repairs ──
  const maxRepairs = buyer.max_repairs ?? Number.POSITIVE_INFINITY;
  const repairsOk = deal.repairs <= maxRepairs;
  if (!repairsOk) {
    ok = false;
    reasons.push("repairs exceed buyer tolerance");
  }

  // ── soft score ──
  // Center-of-band price (1.0 at midpoint, falling to ~0.5 at the edges) and
  // repair headroom (more slack => higher). Average the components present.
  const components: number[] = [];

  if (Number.isFinite(max) && max > min) {
    const mid = (min + max) / 2;
    const halfBand = (max - min) / 2;
    const dist = Math.min(Math.abs(deal.price - mid) / halfBand, 1);
    components.push(1 - 0.5 * dist);
  }

  if (Number.isFinite(maxRepairs) && maxRepairs > 0) {
    const headroom = Math.max(0, 1 - deal.repairs / maxRepairs);
    components.push(0.5 + 0.5 * headroom);
  }

  const soft =
    components.length > 0
      ? components.reduce((a, b) => a + b, 0) / components.length
      : 0.75;

  // A non-qualifying buyer is capped low so it always ranks under qualifiers.
  const score = ok ? Number(soft.toFixed(3)) : Number((soft * 0.25).toFixed(3));

  if (ok) reasons.unshift("fits buy-box");

  return { score, qualifies: ok, reasons };
}

/** Convenience: build MatchInput from an underwrite result + property. */
export function matchInputFromUnderwrite(
  property: MatchInput["property"],
  uw: Pick<UnderwriteResult, "buyerCeiling" | "repairs">,
): MatchInput {
  return { property, price: uw.buyerCeiling, repairs: uw.repairs };
}
