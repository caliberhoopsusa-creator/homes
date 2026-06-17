// Comparative market analysis — Max Maxwell's ARV method, made deterministic.
// PURE: no I/O, no deps. Two steps: (1) select truly-comparable sold properties,
// (2) adjust each comp to the subject and average the adjusted values into an ARV.
// Garbage ARV breaks every downstream number, so selection is strict by default.

/** The property we're valuing. */
export interface CompSubject {
  lat: number | null;
  lng: number | null;
  sqft: number | null;
  beds: number | null;
  /** Garage spaces (0 if unknown). */
  garage?: number | null;
}

/** A recently-sold property considered as a comp. */
export interface SoldComp {
  id: string;
  lat: number | null;
  lng: number | null;
  sqft: number | null;
  beds: number | null;
  garage?: number | null;
  /** Closed sale price. */
  salePrice: number;
  /** ISO date the sale closed. */
  soldDate: string;
}

/** Selection thresholds (Max's lesson 3 / module 4 criteria). */
export interface CompCriteria {
  /** Max distance from subject, miles. */
  maxMiles: number;
  /** Max age of the sale, days. */
  maxAgeDays: number;
  /** Allowed sqft delta as a fraction (0.2 = ±20%). */
  sqftTolerance: number;
  /** Allowed bedroom delta (count). */
  bedsTolerance: number;
  /** Cap on returned comps (his "top 3–5"). */
  maxComps: number;
}

export const DEFAULT_COMP_CRITERIA: CompCriteria = {
  maxMiles: 1,
  maxAgeDays: 180,
  sqftTolerance: 0.2,
  bedsTolerance: 1,
  maxComps: 5,
};

/** Per-feature $ adjustments applied to a comp to match the subject (market-tunable). */
export interface CompAdjustments {
  perBedroom: number;
  perSqft: number;
  perGarage: number;
}

export const DEFAULT_COMP_ADJUSTMENTS: CompAdjustments = {
  perBedroom: 10000,
  perSqft: 60,
  perGarage: 7000,
};

const EARTH_RADIUS_MI = 3958.8;
const toRad = (deg: number): number => (deg * Math.PI) / 180;

/** Great-circle distance in miles. Returns Infinity if either point is missing. */
export function haversineMiles(
  aLat: number | null,
  aLng: number | null,
  bLat: number | null,
  bLng: number | null,
): number {
  if (aLat == null || aLng == null || bLat == null || bLng == null) return Infinity;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.sqrt(h));
}

const ageDays = (soldDate: string, now: Date): number =>
  (now.getTime() - new Date(soldDate).getTime()) / 86_400_000;

/**
 * Select the closest, most-comparable sold properties. Filters by distance,
 * recency, sqft band, and bedroom band; ranks closest-first; caps at maxComps.
 */
export function selectComps(
  subject: CompSubject,
  candidates: readonly SoldComp[],
  criteria: CompCriteria = DEFAULT_COMP_CRITERIA,
  now: Date = new Date(),
): SoldComp[] {
  if (subject.sqft == null || subject.sqft <= 0) return [];

  const eligible = candidates
    .map((c) => ({ c, miles: haversineMiles(subject.lat, subject.lng, c.lat, c.lng) }))
    .filter(({ c, miles }) => {
      if (!Number.isFinite(miles) || miles > criteria.maxMiles) return false;
      if (ageDays(c.soldDate, now) > criteria.maxAgeDays) return false;
      if (c.sqft == null || c.sqft <= 0) return false;
      const sqftDelta = Math.abs(c.sqft - subject.sqft!) / subject.sqft!;
      if (sqftDelta > criteria.sqftTolerance) return false;
      if (
        c.beds != null &&
        subject.beds != null &&
        Math.abs(c.beds - subject.beds) > criteria.bedsTolerance
      ) {
        return false;
      }
      if (!(c.salePrice > 0)) return false;
      return true;
    })
    .sort((a, b) => a.miles - b.miles);

  return eligible.slice(0, criteria.maxComps).map(({ c }) => c);
}

export interface ArvEstimate {
  /** Estimated after-repair value (averaged adjusted comp values). */
  arv: number;
  /** Number of comps that backed the estimate (0 ⇒ no usable comps). */
  compCount: number;
  /** Each comp's price adjusted to the subject (for the deal package / audit). */
  adjusted: { id: string; adjustedValue: number }[];
}

/**
 * Estimate ARV by adjusting each comp's sale price to the subject (Max's method:
 * add value the subject has over the comp, subtract value the comp has over the
 * subject) and averaging. Returns compCount 0 when there are no comps.
 */
export function estimateArvFromComps(
  subject: CompSubject,
  comps: readonly SoldComp[],
  adj: CompAdjustments = DEFAULT_COMP_ADJUSTMENTS,
): ArvEstimate {
  if (comps.length === 0) return { arv: 0, compCount: 0, adjusted: [] };

  const subjBeds = subject.beds ?? 0;
  const subjSqft = subject.sqft ?? 0;
  const subjGarage = subject.garage ?? 0;

  const adjusted = comps.map((c) => {
    const value =
      c.salePrice +
      (subjBeds - (c.beds ?? 0)) * adj.perBedroom +
      (subjSqft - (c.sqft ?? 0)) * adj.perSqft +
      (subjGarage - (c.garage ?? 0)) * adj.perGarage;
    return { id: c.id, adjustedValue: Math.round(value) };
  });

  const arv = Math.round(
    adjusted.reduce((sum, a) => sum + a.adjustedValue, 0) / adjusted.length,
  );
  return { arv, compCount: adjusted.length, adjusted };
}
