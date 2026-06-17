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
  // Needs network egress. Confirm the situs/city field names via the smoke test
  // in docs/COUNTY-DATA.md and adjust `map`/`where` if the live schema differs.
  "mt-absentee-billings": {
    kind: "arcgis",
    layerUrl:
      "https://gisservicemt.gov/arcgis/rest/services/MSDI_Framework/Parcels/MapServer/0",
    where: "OwnerState <> 'MT' AND PropCity = 'BILLINGS'",
    outFields: "*",
    resultRecordCount: 200,
    map: {
      record_id: "PARCELID",
      address: "PropStreetAddress",
      city: "PropCity",
      state: "PropState",
      zip: "PropZipCode",
      est_value: "TotalValue",
    },
  },
};

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
    return Response.json(arcgisToCountyRecords(await res.json(), feed.map));
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "feed fetch failed" },
      { status: 502 },
    );
  }
}
