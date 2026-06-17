// One-click buyer discovery: fetch county parcel ownership (cadastral), find
// multi-property owners (= investors/landlords), and add them as buyers. Mirrors
// the radius-pull flow. Needs network egress (the cadastral ArcGIS host); 502s if
// blocked, 202s if the DB isn't configured. New buyers only (dedupe by name).
import { arcgisQueryUrl } from "@parcel/sourcing";
import { inferBuyersFromOwnership, type OwnerParcel } from "@/lib/buyers-import";
import { createBuyer, getBuyers, isLive } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// MT statewide Cadastral parcels, scoped to Billings. Confirm field names with the
// smoke test in docs/COUNTY-DATA.md and adjust if the live schema differs.
const LAYER =
  "https://gisservicemt.gov/arcgis/rest/services/MSDI_Framework/Parcels/MapServer/0";
const WHERE = "PropCity = 'BILLINGS'";
const F = {
  owner_name: "OwnerName",
  owner_city: "OwnerCity",
  owner_state: "OwnerState",
  property_city: "PropCity",
  value: "TotalValue",
} as const;

const s = (v: unknown): string | null => (v == null ? null : String(v).trim() || null);
const n = (v: unknown): number | null => {
  const x = typeof v === "number" ? v : Number(String(v ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(x) && x !== 0 ? x : null;
};

export async function POST(): Promise<Response> {
  if (!isLive()) {
    return Response.json({ ok: false, reason: "database not configured" }, { status: 202 });
  }

  const url = arcgisQueryUrl(LAYER, {
    where: WHERE,
    outFields: Object.values(F).join(","),
    resultRecordCount: 1000,
  });

  let features: Array<{ attributes?: Record<string, unknown> | null }>;
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; Parcel/1.0)" },
    });
    if (!res.ok) return Response.json({ ok: false, error: `upstream ${res.status}` }, { status: 502 });
    const json = (await res.json()) as { features?: typeof features };
    features = json.features ?? [];
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "feed fetch failed" },
      { status: 502 },
    );
  }

  const parcels: OwnerParcel[] = features.map((feat) => {
    const a = feat.attributes ?? {};
    return {
      owner_name: s(a[F.owner_name]) ?? "",
      owner_city: s(a[F.owner_city]),
      owner_state: s(a[F.owner_state]),
      property_city: s(a[F.property_city]),
      value: n(a[F.value]),
    };
  });

  const inferred = inferBuyersFromOwnership(parcels);
  const existing = new Set((await getBuyers()).map((b) => (b.name ?? "").toLowerCase()));
  const fresh = inferred.filter((b) => b.name && !existing.has(b.name.toLowerCase()));
  for (const b of fresh) await createBuyer(b);

  return Response.json({ ok: true, discovered: inferred.length, added: fresh.length });
}
