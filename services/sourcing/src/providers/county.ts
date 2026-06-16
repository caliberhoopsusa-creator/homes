// FREE public-records PropertyProvider. Pulls PUBLIC county records (tax-delinquent,
// probate, code-violation, pre-foreclosure) into PropertyCandidate[] — the zero-cost
// alternative to paid data vendors. Sources are configured (env/opts), never secret.
//
// County data formats vary wildly per jurisdiction, so each source is expected to
// return a NORMALIZED JSON array of `CountyRecord` (an adapter/ETL — out of scope
// here — produces that from raw county HTML/CSV/PDF). This provider does the mapping,
// distress-tagging, and ToS guard (PRD §8.4: no Zillow/Redfin/Trulia/Realtor).
import type {
  RadiusPullRequest,
  PropertyCandidate,
  DistressSignal,
} from "@parcel/types";
import type { PropertyProvider } from "../provider.js";
import { normalizeDistress } from "../normalize.js";

const DENY_DOMAINS = ["zillow.com", "redfin.com", "trulia.com", "realtor.com"];

/** A configured county-record source: a URL + the distress signal it implies. */
export interface CountySource {
  /** URL returning a normalized JSON array of CountyRecord. */
  url: string;
  /** Distress signal this list implies (e.g. a tax-delinquent list → 'tax_delinquent'). */
  distress: DistressSignal;
  /** Human label used in the stable source_id, e.g. "Yellowstone County, MT". */
  jurisdiction: string;
}

/** The normalized record shape each source must return (per-county adapter's job). */
export interface CountyRecord {
  record_id?: string;
  address: string;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
  year_built?: number | null;
  est_value?: number | null;
}

/** The slice of fetch we consume — injectable so tests need no live calls. */
interface FetchResponse {
  ok: boolean;
  status: number;
  statusText: string;
  json(): Promise<unknown>;
}
export type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<FetchResponse>;

export interface CountyRecordsProviderOptions {
  sources?: CountySource[];
  /** Injectable for tests; defaults to global fetch. */
  fetchImpl?: FetchLike;
}

export class CountyRecordsProvider implements PropertyProvider {
  private readonly sources: CountySource[];
  private readonly fetchImpl: FetchLike;

  constructor(opts: CountyRecordsProviderOptions = {}) {
    this.sources = opts.sources ?? parseSourcesFromEnv();
    if (this.sources.length === 0) {
      throw new Error(
        "CountyRecordsProvider: no COUNTY_RECORDS_SOURCES configured. " +
          "Set it (JSON array of {url,distress,jurisdiction}) or use PROPERTY_PROVIDER=mock.",
      );
    }
    this.fetchImpl = opts.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
  }

  async search(_req: RadiusPullRequest): Promise<PropertyCandidate[]> {
    const out: PropertyCandidate[] = [];
    for (const source of this.sources) {
      if (!isPermitted(source.url)) continue; // ToS guard
      const res = await this.fetchImpl(source.url, {
        headers: { accept: "application/json" },
      });
      if (!res.ok) {
        throw new Error(
          `CountyRecordsProvider: ${res.status} ${res.statusText} from ${source.jurisdiction}`,
        );
      }
      const records = (await res.json()) as CountyRecord[];
      for (const r of Array.isArray(records) ? records : []) {
        const candidate = mapRecord(r, source);
        if (candidate) out.push(candidate);
      }
    }
    return out;
  }
}

function parseSourcesFromEnv(): CountySource[] {
  const raw = process.env.COUNTY_RECORDS_SOURCES;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CountySource[]) : [];
  } catch {
    return [];
  }
}

function isPermitted(url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return false;
  }
  return !DENY_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
}

function mapRecord(
  r: CountyRecord,
  source: CountySource,
): PropertyCandidate | null {
  if (!r.address) return null;
  return {
    source: "county",
    // Stable id for cross-run dedupe: jurisdiction + the county's record id (or address).
    source_id: `${source.jurisdiction}:${r.record_id ?? r.address}`,
    address: r.address,
    city: r.city ?? null,
    state: r.state ?? null,
    zip: r.zip ?? null,
    lat: null, // county records aren't geocoded; runPull keeps null-coord candidates
    lng: null,
    beds: r.beds ?? null,
    baths: r.baths ?? null,
    sqft: r.sqft ?? null,
    year_built: r.year_built ?? null,
    est_value: r.est_value ?? null,
    asking: null,
    distress_signals: normalizeDistress([source.distress]),
  };
}
