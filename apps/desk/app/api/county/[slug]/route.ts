// Free county-records feed. Serves normalized CountyRecord[] JSON that the
// CountyRecordsProvider (PROPERTY_PROVIDER=county) fetches — the zero-cost lead
// path. Two kinds of feed:
//   - csv:    a bundled/exported county CSV (works offline; demo + manual exports)
//   - arcgis: a live county/state GIS parcel layer (needs network egress)
// Point COUNTY_RECORDS_SOURCES at {desk}/api/county/<slug>. See docs/COUNTY-DATA.md.
import {
  arcgisQueryUrl,
  arcgisToCountyRecords,
  csvToCountyRecords,
  type ArcgisFieldMap,
  type CsvColumnMap,
} from "@parcel/sourcing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Feed =
  | { kind: "csv"; csv: string; map: CsvColumnMap }
  | {
      kind: "arcgis";
      layerUrl: string;
      where: string;
      outFields: string;
      map: ArcgisFieldMap;
      resultRecordCount?: number;
      /** When the situs city/state/zip live in one combined field (mapped to `city`),
       *  split it into city/state/zip (e.g. "BILLINGS, MT 59101"). */
      splitCityStateZip?: boolean;
    };

const FEEDS: Record<string, Feed> = {
  // Offline sample (no egress) — demonstrates the format + the full loop.
  "yellowstone-tax-delinquent": {
    kind: "csv",
    map: {
      address: "Address",
      record_id: "Parcel",
      city: "City",
      state: "State",
      zip: "Zip",
      beds: "Beds",
      est_value: "AssessedValue",
    },
    csv: `Parcel,Address,City,State,Zip,Beds,AssessedValue
TD-1001,"742 N 29th St",Billings,MT,59101,3,228000
TD-1002,118 Wyoming Ave,Billings,MT,59101,2,164500
TD-1003,3410 Granger Ave,Billings,MT,59102,4,312000`,
  },

  // REAL source: Montana Cadastral statewide parcels (MSDI). Filters to ABSENTEE
  // owners (owner mailing state != MT) in Billings — a top distress signal.
  // Field names verified live (2026-06): situs is AddressLine1 + a combined
  // CityStateZip; owner mailing fields are OwnerCity/OwnerState/OwnerZipCode.
  "mt-absentee-billings": {
    kind: "arcgis",
    layerUrl:
      "https://gisservicemt.gov/arcgis/rest/services/MSDI_Framework/Parcels/MapServer/0",
    where: "OwnerState <> 'MT' AND CityStateZip LIKE '%BILLINGS%'",
    outFields: "PARCELID,AddressLine1,CityStateZip,OwnerState,TotalValue",
    resultRecordCount: 200,
    splitCityStateZip: true,
    map: {
      record_id: "PARCELID",
      address: "AddressLine1",
      city: "CityStateZip", // combined; split into city/state/zip below
      est_value: "TotalValue",
    },
  },
};

const CITY_STATE_ZIP = /^(.*?),?\s*([A-Za-z]{2})\s+(\d{5})(?:-\d{4})?$/;

/** "BILLINGS, MT 59101" → { city: "Billings", state: "MT", zip: "59101" }. */
function splitCityStateZip<T extends { city?: string | null }>(
  records: T[],
): T[] {
  return records.map((r) => {
    const m = r.city ? CITY_STATE_ZIP.exec(r.city.trim()) : null;
    if (!m) return r;
    const city = m[1]
      .trim()
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return { ...r, city, state: m[2].toUpperCase(), zip: m[3] };
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  const feed = FEEDS[slug];
  if (!feed) {
    return Response.json({ error: `unknown county feed: ${slug}` }, { status: 404 });
  }

  if (feed.kind === "csv") {
    return Response.json(csvToCountyRecords(feed.csv, feed.map));
  }

  // arcgis: fetch the live layer (server-side; requires egress) and normalize.
  const url = arcgisQueryUrl(feed.layerUrl, {
    where: feed.where,
    outFields: feed.outFields,
    resultRecordCount: feed.resultRecordCount,
  });
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; Parcel/1.0)" },
    });
    if (!res.ok) {
      return Response.json({ error: `upstream ${res.status}` }, { status: 502 });
    }
    let records = arcgisToCountyRecords(await res.json(), feed.map);
    if (feed.splitCityStateZip) records = splitCityStateZip(records);
    return Response.json(records);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "feed fetch failed" },
      { status: 502 },
    );
  }
}
