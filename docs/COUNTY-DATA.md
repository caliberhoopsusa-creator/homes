# Free county-records lead path

The zero-cost alternative to a paid data provider (PropStream/BatchData). County
treasurer/clerk offices publish **public** distressed lists (tax-delinquent,
probate, code-violation, pre-foreclosure). We turn those into leads — no data bill.

## How it flows
```
county export (CSV)  →  csvToCountyRecords (column map)  →  normalized JSON feed
   →  CountyRecordsProvider (PROPERTY_PROVIDER=county, COUNTY_RECORDS_SOURCES)
   →  runPull → properties → skiptrace → underwriting → desk
```

## Pieces (built)
- **`services/sourcing/src/adapters/csv.ts`** — `csvToCountyRecords(csv, map)`: pure CSV→`CountyRecord[]`
  normalizer (handles quotes/commas, coerces `$1,234`→numbers). One **column map** per county = config, not code.
- **`apps/desk/app/api/county/[slug]/route.ts`** — serves a feed's normalized JSON. A working sample lives at
  `/api/county/yellowstone-tax-delinquent`.
- **`services/sourcing/src/providers/county.ts`** — `CountyRecordsProvider` fetches the feed URLs in
  `COUNTY_RECORDS_SOURCES`, ToS-denylisting Zillow/Redfin/etc.

## Two feed kinds (`app/api/county/[slug]/route.ts`)
- **`csv`** — a bundled/exported county CSV. Works offline. For manual exports + the demo
  (`/api/county/yellowstone-tax-delinquent`).
- **`arcgis`** — a live county/state GIS parcel layer (returns JSON). Needs network egress. The route
  fetches `<layer>/query?...f=json` and normalizes via `arcgisToCountyRecords`.
- **`socrata`** — a city/county **open-data (SODA)** dataset on `data.<city>.gov`: code violations,
  evictions, vacant/demolition lists — high-signal FREE distress lists. The route builds
  `https://<domain>/resource/<id>.json?$where=...&$limit=N` via `socrataQueryUrl` and normalizes via
  `socrataToCountyRecords`. Optional `SOCRATA_APP_TOKEN` env (raises rate limits; sent as `X-App-Token`,
  never hardcoded). Example slug: **`/api/county/socrata-code-violations-example`** (City of Chicago
  building violations — swap `domain`/`datasetId`/`map` for your market's portal + columns).

  Find the dataset id + columns: open `https://<domain>/resource/<id>.json?$limit=1` and read the keys.
  Then add it to `COUNTY_RECORDS_SOURCES` with `"distress":"code_violation"` (or `eviction`, `vacant`).
  Because leads now **list-stack by address**, the same house appearing here *and* on the absentee/tax
  feeds collapses into one lead carrying every signal — which is exactly what lifts its motivation score.

## Real Montana source (wired): the statewide Cadastral
MT runs a centralized cadastral GIS covering every county — **owner name, owner MAILING city/state,
assessed value, parcel id** — as a queryable ArcGIS REST service. Tax-delinquent bulk lists are *not*
published cleanly (county treasurers post PDFs/portals), so we lead with the **absentee** signal:
**owner mailing state ≠ MT** = an out-of-area owner (a top wholesaling target).

- Wired feed: **`/api/county/mt-absentee-billings`** → MSDI Parcels, `where OwnerState <> 'MT' AND PropCity = 'BILLINGS'`.
- Endpoint: `https://gisservicemt.gov/arcgis/rest/services/MSDI_Framework/Parcels/MapServer/0`
  (mirror: `https://gis.dnrc.mt.gov/arcgis/rest/services/DNRALL/Cadastral/MapServer/0`).

### ⚠️ One-time confirm (run where egress is allowed — not this sandbox)
The exact **situs address / city field names** are best-guesses (`PropStreetAddress`/`PropCity`/`PropState`/
`PropZipCode`); confirmed fields are `OwnerName, OwnerCity, OwnerState, TotalValue, PARCELID`. Smoke-test:
```
curl -A "Mozilla/5.0" "https://gisservicemt.gov/arcgis/rest/services/MSDI_Framework/Parcels/MapServer/0/query?where=1%3D1&outFields=*&resultRecordCount=2&returnGeometry=false&f=json"
```
Check the `fields`/`attributes`, then fix the `map`/`where` in the route if the situs columns differ.

## Use it
```
PROPERTY_PROVIDER=county
COUNTY_RECORDS_SOURCES=[{"url":"https://<desk-host>/api/county/mt-absentee-billings","distress":"absentee","jurisdiction":"Yellowstone County, MT"}]
```
Then hit the desk's **Pull** button → `/api/pull`: records flow in as `properties` (source `county`) →
skip-trace → underwriting → pipeline.

> County records aren't geocoded; `runPull` keeps null-coord candidates (already region-scoped via the
> feed's filter), then skip-trace + underwriting run as usual.

## County GIS alternatives (also fetchable)
- **Gallatin (Bozeman):** `https://gis.gallatin.mt.gov/arcgis/rest/services/GENERAL_VIEWER/MapServer`
- **Missoula:** `https://services8.arcgis.com/a0HR33xuh1KoWKl7/arcgis/rest/services/MISSOULA_COUNTY_DATA/FeatureServer`
  (+ open-data hub with CSV/GeoJSON downloads: `https://missoula-county-open-data-mcgis.hub.arcgis.com/`)

## Finding buyers from the same data
The cadastral feeds **both sides**: absentee owners are sellers; **multi-property owners are buyers**
(investors/landlords). `inferBuyersFromOwnership` (`apps/desk/lib/buyers-import.ts`) groups parcels by
owner; anyone holding **≥2** becomes an investor buy-box (areas they hold in, price band from their
parcel values, mailing in notes); govt/banks/HOAs are filtered out.

- Query the cadastral with owner fields, e.g.
  `outFields=OwnerName,OwnerCity,OwnerState,PropCity,TotalValue`, transform to
  `[{owner_name, owner_city, owner_state, property_city, value}]`, and paste into the Buyers page
  **Import** panel (it auto-detects ownership vs cash-sale records).
- Gold-standard buyers = recent **cash** purchasers from deed/recorder records (no mortgage lien);
  MT publishes those via treasurer/recorder portals (manual), so layer them in later.
