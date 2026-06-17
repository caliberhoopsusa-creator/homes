// Free county-records feed. Serves normalized CountyRecord[] JSON that the
// CountyRecordsProvider (PROPERTY_PROVIDER=county) fetches — the zero-cost lead
// path. Each feed is a county export (CSV) + a column map; swap a sample's `csv`
// for a real county file (or fetch it here) and point COUNTY_RECORDS_SOURCES at
// {desk}/api/county/<slug>. See docs/COUNTY-DATA.md.
import { csvToCountyRecords, type CsvColumnMap } from "@parcel/sourcing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FEEDS: Record<string, { csv: string; map: CsvColumnMap }> = {
  // Sample shape of a county treasurer tax-delinquent export. Replace `csv` with
  // a real export (these addresses are illustrative).
  "yellowstone-tax-delinquent": {
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
  return Response.json(csvToCountyRecords(feed.csv, feed.map));
}
