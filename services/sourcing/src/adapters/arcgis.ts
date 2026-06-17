// ArcGIS FeatureServer/MapServer query JSON → CountyRecord[]. County GIS "parcel"
// layers are the most fetchable public source: a GET to
//   <layer>/query?where=1=1&outFields=*&f=json&returnGeometry=false
// returns { features: [{ attributes: {...} }] }. Attribute field names vary per
// county, so callers supply a field map. Pure + dependency-free.
import type { CountyRecord } from "../providers/county.js";

/** Maps CountyRecord fields → the ArcGIS layer's attribute field names. */
export interface ArcgisFieldMap {
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

interface ArcgisFeature {
  attributes?: Record<string, unknown> | null;
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}
function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Transform an ArcGIS query response into CountyRecord[] (rows without an address dropped). */
export function arcgisToCountyRecords(json: unknown, map: ArcgisFieldMap): CountyRecord[] {
  const features = (json as { features?: ArcgisFeature[] })?.features ?? [];
  const out: CountyRecord[] = [];
  for (const f of features) {
    const a = f.attributes ?? {};
    const address = str(a[map.address]);
    if (!address) continue;
    out.push({
      record_id: (map.record_id ? str(a[map.record_id]) : null) ?? undefined,
      address,
      city: map.city ? str(a[map.city]) : null,
      state: map.state ? str(a[map.state]) : null,
      zip: map.zip ? str(a[map.zip]) : null,
      beds: map.beds ? num(a[map.beds]) : null,
      baths: map.baths ? num(a[map.baths]) : null,
      sqft: map.sqft ? num(a[map.sqft]) : null,
      year_built: map.year_built ? num(a[map.year_built]) : null,
      est_value: map.est_value ? num(a[map.est_value]) : null,
    });
  }
  return out;
}

/** Build an ArcGIS layer query URL that returns attribute JSON (no geometry). */
export function arcgisQueryUrl(
  layerUrl: string,
  opts: { where?: string; outFields?: string; resultRecordCount?: number } = {},
): string {
  const p = new URLSearchParams({
    where: opts.where ?? "1=1",
    outFields: opts.outFields ?? "*",
    returnGeometry: "false",
    f: "json",
  });
  if (opts.resultRecordCount) p.set("resultRecordCount", String(opts.resultRecordCount));
  return `${layerUrl.replace(/\/$/, "")}/query?${p.toString()}`;
}
