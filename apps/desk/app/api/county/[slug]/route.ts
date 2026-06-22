// Free county-records feed. Serves normalized CountyRecord[] JSON that the
// CountyRecordsProvider (PROPERTY_PROVIDER=county) fetches — the zero-cost lead
// path. Two kinds of feed:
//   - csv:     a bundled/exported county CSV (works offline; demo + manual exports)
//   - arcgis:  a live county/state GIS parcel layer (needs network egress)
//   - socrata: a city/county open-data (SODA) dataset — code violations, evictions,
//              vacant/demolition lists (needs network egress; optional app token)
// Point COUNTY_RECORDS_SOURCES at {desk}/api/county/<slug>. See docs/COUNTY-DATA.md.
import {
  arcgisQueryUrl,
  arcgisToCountyRecords,
  csvToCountyRecords,
  socrataQueryUrl,
  socrataToCountyRecords,
  type ArcgisFieldMap,
  type CsvColumnMap,
  type SocrataFieldMap,
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
    }
  | {
      kind: "socrata";
      /** Portal host, e.g. "data.cityofchicago.org". */
      domain: string;
      /** Dataset (4x4) id, e.g. "22u3-xenr". */
      datasetId: string;
      where?: string;
      select?: string;
      order?: string;
      limit?: number;
      map: SocrataFieldMap;
      splitCityStateZip?: boolean;
    };

// Montana statewide cadastral (MSDI), filtered to ABSENTEE owners (owner mailing
// state != MT) in one city. Same proven endpoint + verified field names as the
// original Billings feed — so adding a city is one line, and each city yields a
// fresh batch of leads. cityUpper must match how the city appears in the
// CityStateZip field, e.g. "GREAT FALLS".
const mtAbsentee = (cityUpper: string): Feed => ({
  kind: "arcgis",
  layerUrl:
    "https://gisservicemt.gov/arcgis/rest/services/MSDI_Framework/Parcels/MapServer/0",
  where: `OwnerState <> 'MT' AND CityStateZip LIKE '%${cityUpper}%'`,
  outFields: "PARCELID,AddressLine1,CityStateZip,OwnerState,TotalValue",
  resultRecordCount: 200,
  splitCityStateZip: true,
  map: {
    record_id: "PARCELID",
    address: "AddressLine1",
    city: "CityStateZip", // combined; split into city/state/zip below
    est_value: "TotalValue",
  },
});

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

  // REAL source: Montana Cadastral statewide parcels (MSDI), absentee owners per
  // city. Field names verified live (2026-06). Add a city = add a line below +
  // a matching entry in COUNTY_RECORDS_SOURCES.
  "mt-absentee-billings": mtAbsentee("BILLINGS"),
  "mt-absentee-missoula": mtAbsentee("MISSOULA"),
  "mt-absentee-bozeman": mtAbsentee("BOZEMAN"),
  "mt-absentee-greatfalls": mtAbsentee("GREAT FALLS"),
  "mt-absentee-kalispell": mtAbsentee("KALISPELL"),
  "mt-absentee-helena": mtAbsentee("HELENA"),

  // EXAMPLE Socrata (SODA) code-violation feed. Thousands of cities publish these
  // on data.<city>.gov — a high-signal FREE distress list. This points at a real,
  // stable dataset (City of Chicago building violations) to prove the loop; for
  // your own market, swap domain/datasetId/map for your city's portal + columns
  // and add the slug to COUNTY_RECORDS_SOURCES with distress: "code_violation".
  // Verify the dataset's column names at https://<domain>/resource/<id>.json?$limit=1
  "socrata-code-violations-example": {
    kind: "socrata",
    domain: "data.cityofchicago.org",
    datasetId: "22u3-xenr",
    where: "violation_status='OPEN'",
    select: "id,address,violation_status,violation_date",
    order: "violation_date DESC",
    limit: 200,
    map: {
      record_id: "id",
      address: "address",
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

  if (feed.kind === "socrata") {
    const url = socrataQueryUrl(feed.domain, feed.datasetId, {
      where: feed.where,
      select: feed.select,
      order: feed.order,
      limit: feed.limit,
    });
    // App token is optional (raises rate limits); read from env, never hardcoded.
    const token = process.env.SOCRATA_APP_TOKEN?.trim();
    const headers = token ? { "X-App-Token": token } : undefined;
    try {
      const res = await fetchWithRetry(url, headers);
      if (!res.ok) {
        return Response.json({ error: `upstream ${res.status}` }, { status: 502 });
      }
      let records = socrataToCountyRecords(await res.json(), feed.map);
      if (feed.splitCityStateZip) records = splitCityStateZip(records);
      return Response.json(records);
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : "feed fetch failed" },
        { status: 502 },
      );
    }
  }

  // arcgis: fetch the live layer (server-side; requires egress) and normalize.
  // The government endpoint can be slow/flaky, so we time out and retry once
  // rather than letting a transient hiccup fail the operator's whole lead pull.
  const url = arcgisQueryUrl(feed.layerUrl, {
    where: feed.where,
    outFields: feed.outFields,
    resultRecordCount: feed.resultRecordCount,
  });
  try {
    const res = await fetchWithRetry(url);
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

const FETCH_TIMEOUT_MS = 25_000;

/** GET with a timeout; one retry on timeout/network error before giving up. */
async function fetchWithRetry(
  url: string,
  extraHeaders?: Record<string, string>,
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      return await fetch(url, {
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; Parcel/1.0)",
          ...extraHeaders,
        },
        signal: ctrl.signal,
      });
    } catch (err) {
      lastErr = err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("feed fetch failed");
}
