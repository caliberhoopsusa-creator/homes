// One-click buyer discovery: read county parcel ownership (MT cadastral) across
// our farm cities, find multi-property owners (= investors/landlords/cash buyers),
// and add them as buyers with a buy-box inferred from what they hold. Free + real.
// Needs network egress (the cadastral ArcGIS host); 502 if blocked, 202 if the DB
// isn't configured. New buyers only (dedupe by name).
import { arcgisQueryUrl } from "@parcel/sourcing";
import { inferBuyersFromOwnership, type OwnerParcel } from "@/lib/buyers-import";
import { createBuyer, getBuyers, isLive } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const LAYER =
  "https://gisservicemt.gov/arcgis/rest/services/MSDI_Framework/Parcels/MapServer/0";
// Same footprint as the lead feeds, so discovered buyers cover where our leads are.
const CITIES = ["BILLINGS", "MISSOULA", "BOZEMAN", "GREAT FALLS", "KALISPELL", "HELENA"];
const OUT_FIELDS = "OwnerName,CityStateZip,OwnerCity,OwnerState,TotalValue";

const CITY_STATE_ZIP = /^(.*?),?\s*[A-Za-z]{2}\s+\d{5}/;
const titleCase = (s: string): string =>
  s.trim().toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

/** "BILLINGS, MT 59101" → "Billings" (the property's city, for the buy-box). */
function cityOf(cityStateZip: string | null): string | null {
  if (!cityStateZip) return null;
  const m = CITY_STATE_ZIP.exec(cityStateZip.trim());
  return m ? titleCase(m[1]!) : null;
}

const s = (v: unknown): string | null => (v == null ? null : String(v).trim() || null);
const n = (v: unknown): number | null => {
  const x = typeof v === "number" ? v : Number(String(v ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(x) && x !== 0 ? x : null;
};

async function fetchCity(city: string): Promise<OwnerParcel[]> {
  const url = arcgisQueryUrl(LAYER, {
    where: `CityStateZip LIKE '%${city}%'`,
    outFields: OUT_FIELDS,
    resultRecordCount: 1000,
  });
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; Parcel/1.0)" },
  });
  if (!res.ok) throw new Error(`upstream ${res.status} for ${city}`);
  const json = (await res.json()) as {
    features?: Array<{ attributes?: Record<string, unknown> | null }>;
  };
  return (json.features ?? []).map((feat) => {
    const a = feat.attributes ?? {};
    return {
      owner_name: s(a.OwnerName) ?? "",
      owner_city: s(a.OwnerCity),
      owner_state: s(a.OwnerState),
      property_city: cityOf(s(a.CityStateZip)),
      value: n(a.TotalValue),
    } satisfies OwnerParcel;
  });
}

export async function POST(): Promise<Response> {
  if (!isLive()) {
    return Response.json({ ok: false, reason: "database not configured" }, { status: 202 });
  }

  // Pull every city in parallel; tolerate a city failing (one flaky query
  // shouldn't sink the whole discovery).
  const settled = await Promise.allSettled(CITIES.map(fetchCity));
  const parcels = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  if (parcels.length === 0) {
    const firstErr = settled.find((r) => r.status === "rejected") as
      | PromiseRejectedResult
      | undefined;
    return Response.json(
      { ok: false, error: firstErr?.reason?.message ?? "no cadastral data returned" },
      { status: 502 },
    );
  }

  // Group across ALL cities, so an investor holding in several markets becomes one
  // buyer with a multi-area buy-box.
  const inferred = inferBuyersFromOwnership(parcels);
  const existing = new Set((await getBuyers()).map((b) => (b.name ?? "").toLowerCase()));
  const fresh = inferred.filter((b) => b.name && !existing.has(b.name.toLowerCase()));
  for (const b of fresh) await createBuyer(b);

  return Response.json({
    ok: true,
    scanned: parcels.length,
    discovered: inferred.length,
    added: fresh.length,
  });
}
