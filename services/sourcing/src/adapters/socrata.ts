// Socrata (SODA) open-data → CountyRecord[]. Thousands of city/county portals run
// Socrata (data.<city>.gov) and publish code-violation, eviction, vacant-property,
// and demolition lists as a queryable JSON API:
//   https://<domain>/resource/<datasetId>.json?$where=...&$limit=N
// returns a flat JSON array of records. Field names vary per dataset, so callers
// supply a field map. Pure + dependency-free (an app token, if any, is a header
// added by the caller — never embedded here).
import type { CountyRecord } from "../providers/county.js";

/** Maps CountyRecord fields → the Socrata dataset's column names. `address` required. */
export interface SocrataFieldMap {
  address: string;
  record_id?: string;
  city?: string;
  state?: string;
  zip?: string;
  beds?: string;
  baths?: string;
  sqft?: string;
  year_built?: string;
  est_value?: string;
}

export interface SocrataQueryOptions {
  /** SoQL `$where` clause, e.g. "violation_status='OPEN'". */
  where?: string;
  /** SoQL `$select` (column projection). */
  select?: string;
  /** SoQL `$order`, e.g. "violation_date DESC". */
  order?: string;
  /** Row cap (SODA default is only 1000; set explicitly). */
  limit?: number;
}

function str(v: unknown): string | null {
  if (v == null) return null;
  // Socrata "human_address" fields arrive as a JSON object/string; prefer the
  // plain string form and fall back to the object's `address` key.
  if (typeof v === "object") {
    const a = (v as Record<string, unknown>).address;
    return a == null ? null : str(a);
  }
  const s = String(v).trim();
  return s === "" ? null : s;
}
function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Transform a Socrata JSON response into CountyRecord[] (rows without an address dropped). */
export function socrataToCountyRecords(
  json: unknown,
  map: SocrataFieldMap,
): CountyRecord[] {
  const rows = Array.isArray(json) ? (json as Record<string, unknown>[]) : [];
  const out: CountyRecord[] = [];
  for (const r of rows) {
    const address = str(r[map.address]);
    if (!address) continue;
    out.push({
      record_id: (map.record_id ? str(r[map.record_id]) : null) ?? undefined,
      address,
      city: map.city ? str(r[map.city]) : null,
      state: map.state ? str(r[map.state]) : null,
      zip: map.zip ? str(r[map.zip]) : null,
      beds: map.beds ? num(r[map.beds]) : null,
      baths: map.baths ? num(r[map.baths]) : null,
      sqft: map.sqft ? num(r[map.sqft]) : null,
      year_built: map.year_built ? num(r[map.year_built]) : null,
      est_value: map.est_value ? num(r[map.est_value]) : null,
    });
  }
  return out;
}

/** Build a Socrata SODA query URL returning record JSON. */
export function socrataQueryUrl(
  domain: string,
  datasetId: string,
  opts: SocrataQueryOptions = {},
): string {
  const host = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const p = new URLSearchParams();
  if (opts.select) p.set("$select", opts.select);
  if (opts.where) p.set("$where", opts.where);
  if (opts.order) p.set("$order", opts.order);
  p.set("$limit", String(opts.limit ?? 1000));
  return `https://${host}/resource/${datasetId}.json?${p.toString()}`;
}
