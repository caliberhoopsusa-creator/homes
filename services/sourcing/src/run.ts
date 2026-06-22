// Runner: pull candidates for a radius request, normalize + validate, dedupe
// (within the batch and against existing rows), then insert `properties`.
// Talks to the rest of the system only through Postgres (§7.4); the DB is
// injected via SourcingStore so this stays unit-testable and provider-agnostic.
import type {
  RadiusPullRequest,
  PropertyCandidate,
  PropertyInsert,
  PropertySource,
  DistressSignal,
} from "@parcel/types";
import { propertyCandidate } from "@parcel/types";
import type { PropertyProvider } from "./provider.js";
import { withinRadius } from "./geo.js";
import { normalizeDistress, normalizeAddress } from "./normalize.js";

/** An existing property row, as needed for address-based list-stacking. */
export interface AddressIndexRow {
  id: string;
  address: string;
  distress_signals: DistressSignal[] | null;
}

export interface SourcingStore {
  /** Source ids already present for this source (for cross-run dedupe). */
  existingSourceIds(source: PropertySource): Promise<Set<string>>;
  /** Insert property rows; returns the number actually written. */
  insertProperties(rows: PropertyInsert[]): Promise<number>;
  /**
   * Lightweight (id, address, distress_signals) of existing rows, for matching a
   * pull's candidates to properties already on file by address (list-stacking).
   */
  existingAddressIndex(): Promise<AddressIndexRow[]>;
  /** Replace one property's distress_signals (merge result), keyed by id. */
  mergeDistress(id: string, signals: DistressSignal[]): Promise<void>;
}

export interface PullResult {
  /** Raw candidates returned by the provider. */
  fetched: number;
  /** Deduped, in-radius, filter-passing, schema-valid candidates. */
  prepared: number;
  /** Rows newly inserted (not already in the store). */
  inserted: number;
  /** Existing rows that gained new distress signals from this pull (stacked). */
  stacked: number;
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

  // 5. List-stacking. Collapse same-address candidates within this batch (union
  // their distress signals into one representative), then decide insert-vs-merge
  // against properties already on file by address — so the same house from two
  // free lists becomes ONE lead carrying BOTH signals, never a duplicate row.
  const batchByAddr = new Map<string, PropertyCandidate>();
  for (const c of fresh) {
    const key = normalizeAddress(c.address);
    const rep = batchByAddr.get(key);
    if (rep) {
      rep.distress_signals = unionSignals(rep.distress_signals, c.distress_signals);
    } else {
      batchByAddr.set(key, { ...c });
    }
  }

  const indexByAddr = new Map<string, AddressIndexRow>();
  for (const row of await store.existingAddressIndex()) {
    indexByAddr.set(normalizeAddress(row.address), row);
  }

  const toInsertRows: PropertyInsert[] = [];
  let stacked = 0;
  for (const [key, c] of batchByAddr) {
    const hit = indexByAddr.get(key);
    if (!hit) {
      toInsertRows.push(toInsert(c));
      continue;
    }
    // Already on file → merge any genuinely new signals into the existing row.
    const merged = unionSignals(hit.distress_signals ?? [], c.distress_signals);
    if (merged.length > (hit.distress_signals?.length ?? 0)) {
      await store.mergeDistress(hit.id, merged);
      stacked += 1;
    }
  }

  const inserted =
    toInsertRows.length === 0 ? 0 : await store.insertProperties(toInsertRows);

  return { fetched: raw.length, prepared: deduped.length, inserted, stacked };
}

/** Union two distress-signal lists, deduped, order-stable (a's first). */
function unionSignals(
  a: ReadonlyArray<DistressSignal>,
  b: ReadonlyArray<DistressSignal>,
): DistressSignal[] {
  return [...new Set([...a, ...b])];
}

function passesFilters(c: PropertyCandidate, req: RadiusPullRequest): boolean {
  // Geocoded candidates must fall inside the radius. Candidates WITHOUT coords
  // (county/Firecrawl public-record results) are already region-scoped at the
  // source, so keep them — geocoding can refine later. (Without this they'd be
  // silently dropped, since withinRadius() fails on null coords.)
  if (c.lat !== null && c.lng !== null) {
    if (!withinRadius(req.lat, req.lng, c.lat, c.lng, req.radiusMiles))
      return false;
  }

  const { minBeds, distress } = req.filters;
  // Only enforce minBeds when bed count is KNOWN. Public-record sources (county
  // cadastral) often omit beds — don't silently drop a real lead for a missing
  // field (same principle as the null-coords radius case above).
  if (minBeds !== undefined && c.beds !== null && c.beds < minBeds) return false;
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
