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

## Wire a real county (config step)
1. Get the county's list (download a CSV, or fetch a published one). Many MT counties (Yellowstone,
   Missoula, Gallatin) post tax-delinquent / clerk records; some are PDF/portal → a one-time manual CSV export.
2. Add a feed entry in `app/api/county/[slug]/route.ts` (or fetch the source there): paste/point at the CSV +
   set the **column map** (which CSV headers map to address/city/zip/beds/value).
3. Point the provider at it:
   ```
   PROPERTY_PROVIDER=county
   COUNTY_RECORDS_SOURCES=[{"url":"https://<desk-host>/api/county/<slug>","distress":"tax_delinquent","jurisdiction":"Yellowstone County, MT"}]
   ```
4. Trigger a pull (the desk's **Pull** button → `/api/pull`). Records flow in as `properties` (source `county`).

> County records aren't geocoded; `runPull` keeps null-coord candidates (they're already region-scoped),
> then skip-trace + underwriting run as usual.
