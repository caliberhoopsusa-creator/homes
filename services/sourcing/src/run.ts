// Runner: pull candidates for a radius request, normalize + validate, dedupe
// (within the batch and against existing rows), then insert `properties`.
// Talks to the rest of the system only through Postgres (§7.4); the DB is
// injected via SourcingStore so this stays unit-testable and provider-agnostic.
import type {
  RadiusPullRequest,
  PropertyCandidate,
  PropertyInsert,
  PropertySource,
} from "@parcel/types";
import { propertyCandidate } from "@parcel/types";
import type { PropertyProvider } from "./provider.js";
import { withinRadius } from "./geo.js";
import { normalizeDistress } from "./normalize.js";

export interface SourcingStore {
  /** Source ids already present for this source (for cross-run dedupe). */
  existingSourceIds(source: PropertySource): Promise<Set<string>>;
  /** Insert property rows; returns the number actually written. */
  insertProperties(rows: PropertyInsert[]): Promise<number>;
}

export interface PullResult {
  /** Raw candidates returned by the provider. */
  fetched: number;
  /** Deduped, in-radius, filter-passing, schema-valid candidates. */
  prepared: number;
  /** Rows newly inserted (not already in the store). */
  inserted: number;
}

/**
 * Pull → normalize → validate → radius/filter → dedupe → insert.
 * Returns counts at each stage; `inserted` is the headline number.
 */
export async function runPull(
  provider: PropertyProvider,
  store: SourcingStore,
  req: RadiusPullRequest,
): Promise<PullResult> {
  const raw = await provider.search(req);

  // 1. Normalize distress tags + validate each candidate against the schema.
  const valid: PropertyCandidate[] = [];
  for (const c of raw) {
    const normalized = {
      ...c,
      distress_signals: normalizeDistress(c.distress_signals ?? []),
    };
    const parsed = propertyCandidate.safeParse(normalized);
    if (parsed.success) valid.push(parsed.data);
  }

  // 2. Radius filter (haversine) + request filters (minBeds, distress).
  const inScope = valid.filter((c) => passesFilters(c, req));

  // 3. Dedupe within the batch on source+source_id (null source_id always kept).
  const seen = new Set<string>();
  const deduped: PropertyCandidate[] = [];
  for (const c of inScope) {
    if (c.source_id === null) {
      deduped.push(c);
      continue;
    }
    const k = `${c.source}:${c.source_id}`;
    if (seen.has(k)) continue;
    seen.add(k);
    deduped.push(c);
  }

  // 4. Dedupe against rows already in the store for this source.
  const sources = new Set(deduped.map((c) => c.source));
  const existing = new Map<PropertySource, Set<string>>();
  for (const s of sources) existing.set(s, await store.existingSourceIds(s));

  const fresh = deduped.filter((c) => {
    if (c.source_id === null) return true;
    return !existing.get(c.source)?.has(c.source_id);
  });

  const rows: PropertyInsert[] = fresh.map(toInsert);
  const inserted = rows.length === 0 ? 0 : await store.insertProperties(rows);

  return { fetched: raw.length, prepared: deduped.length, inserted };
}

function passesFilters(c: PropertyCandidate, req: RadiusPullRequest): boolean {
  if (!withinRadius(req.lat, req.lng, c.lat, c.lng, req.radiusMiles))
    return false;

  const { minBeds, distress } = req.filters;
  if (minBeds !== undefined && (c.beds ?? 0) < minBeds) return false;
  if (distress?.length) {
    const have = new Set(c.distress_signals);
    if (!distress.some((d) => have.has(d))) return false;
  }
  return true;
}

function toInsert(c: PropertyCandidate): PropertyInsert {
  return {
    source: c.source,
    source_id: c.source_id,
    address: c.address,
    city: c.city,
    state: c.state,
    zip: c.zip,
    lat: c.lat,
    lng: c.lng,
    beds: c.beds,
    baths: c.baths,
    sqft: c.sqft,
    year_built: c.year_built,
    est_value: c.est_value,
    asking: c.asking,
    distress_signals: c.distress_signals,
  };
}
