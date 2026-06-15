// Deterministic mock provider. Generates a stable, realistic field of candidate
// properties around Billings, MT so tests are reproducible and the runner can be
// exercised without a live API. Default provider (no key needed).
import type {
  RadiusPullRequest,
  PropertyCandidate,
  DistressSignal,
} from "@parcel/types";
import type { PropertyProvider } from "../provider.js";

const BILLINGS = { lat: 45.7833, lng: -108.5007 };
const DISTRESS: DistressSignal[] = [
  "tax_delinquent",
  "preforeclosure",
  "vacant",
  "absentee",
];
// ~69 miles per degree latitude; longitude shrinks by cos(lat) at this latitude.
const MILES_PER_DEG_LAT = 69;
const MILES_PER_DEG_LNG = 69 * Math.cos((BILLINGS.lat * Math.PI) / 180);

/** In-range array access (indices are always valid by construction here). */
function pick<T>(arr: readonly T[], i: number): T {
  return arr[i] as T;
}

/** Small deterministic PRNG (mulberry32) so output is identical run-to-run. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface MockProviderOptions {
  /** Number of raw candidates to generate over the fixed field. */
  count?: number;
  /** Radius (miles) of the fixed field the points are scattered over. */
  fieldRadiusMiles?: number;
  seed?: number;
}

export class MockProvider implements PropertyProvider {
  private readonly count: number;
  private readonly fieldRadiusMiles: number;
  private readonly seed: number;

  constructor(opts: MockProviderOptions = {}) {
    // 1200 points over a 30-mile field leaves ≥500 inside a 25-mile pull while
    // letting a smaller radius return strictly fewer (the runner filters by
    // haversine). The field expands if the request asks for a larger radius.
    this.count = opts.count ?? 1200;
    this.fieldRadiusMiles = opts.fieldRadiusMiles ?? 30;
    this.seed = opts.seed ?? 1337;
  }

  async search(req: RadiusPullRequest): Promise<PropertyCandidate[]> {
    const rand = mulberry32(this.seed);
    const out: PropertyCandidate[] = [];
    // Field is fixed (independent of the request) so a smaller pull radius is a
    // genuine subset; it only widens if the request exceeds the default field.
    const field = Math.max(this.fieldRadiusMiles, req.radiusMiles);

    for (let i = 0; i < this.count; i++) {
      // Uniform disc sample over the fixed field; the runner clips to req radius.
      const angle = rand() * 2 * Math.PI;
      const dist = Math.sqrt(rand()) * field;
      const dLat = (dist * Math.cos(angle)) / MILES_PER_DEG_LAT;
      const dLng = (dist * Math.sin(angle)) / MILES_PER_DEG_LNG;
      const lat = req.lat + dLat;
      const lng = req.lng + dLng;

      const beds = 2 + Math.floor(rand() * 4); // 2..5
      const baths = 1 + Math.floor(rand() * 3); // 1..3
      const sqft = 900 + Math.floor(rand() * 2600); // 900..3500
      const year_built = 1940 + Math.floor(rand() * 80); // 1940..2019
      const est_value = 120_000 + Math.floor(rand() * 480_000); // 120k..600k

      // 1..3 distinct distress signals, always at least one.
      const signalCount = 1 + Math.floor(rand() * 3);
      const signals = new Set<DistressSignal>();
      while (signals.size < signalCount) {
        signals.add(pick(DISTRESS, Math.floor(rand() * DISTRESS.length)));
      }

      out.push({
        source: "manual",
        source_id: `mock-${i}`,
        address: `${100 + i} ${pick(STREETS, i % STREETS.length)}`,
        city: "Billings",
        state: "MT",
        zip: pick(ZIPS, i % ZIPS.length),
        lat,
        lng,
        beds,
        baths,
        sqft,
        year_built,
        est_value,
        asking: null,
        distress_signals: [...signals],
      });
    }

    return out;
  }
}

const STREETS = [
  "Grand Ave",
  "Rimrock Rd",
  "Broadwater Ave",
  "Poly Dr",
  "Central Ave",
  "Lewis Ave",
  "Yellowstone Ave",
  "Shiloh Rd",
  "Monad Rd",
  "King Ave",
];
const ZIPS = ["59101", "59102", "59105", "59106"];

/** The center the default field is generated around (Billings, MT). */
export const MOCK_CENTER = BILLINGS;
