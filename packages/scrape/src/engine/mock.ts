// The keyless default engine. Deterministic, no network — returns fixture pages
// so the whole funnel runs without a real scraper (mirrors the Mock providers
// elsewhere). Still enforces the compliance denylist, so tests can assert that
// denied domains are refused even in mock mode.
import type {
  ScrapeEngine,
  ScrapeOptions,
  SearchOptions,
  CrawlOptions,
  ScrapeResult,
} from "../engine.js";
import { assertPermitted, isPermitted } from "../compliance.js";
import { MockExtractor, type Extractor } from "../extract.js";

/** A deterministic fixture page used for any permitted URL. */
function fixtureMarkdown(url: string): string {
  return [
    `# Property record`,
    ``,
    `Source: ${url}`,
    `123 Mock St, Billings, MT 59101`,
    `3 bed 2 bath 1,450 sqft built 1978`,
    `Estimated value $245,000. Asking price $190,000.`,
    `Status: tax delinquent, absentee owner.`,
    `Owner of record: Jane Q. Owner. Contact jane.owner@example.com (406) 555-0142.`,
    `Mailing address: PO Box 77, Spokane, WA 99201`,
  ].join("\n");
}

export interface MockScrapeEngineOptions {
  extractor?: Extractor;
  /** Deterministic fixture URLs returned by search(). */
  searchResults?: string[];
}

export class MockScrapeEngine implements ScrapeEngine {
  private readonly extractor: Extractor;
  private readonly searchResults: string[];

  constructor(opts: MockScrapeEngineOptions = {}) {
    this.extractor = opts.extractor ?? new MockExtractor();
    this.searchResults = opts.searchResults ?? [
      "https://billings.county-records.example.gov/parcels/123-mock-st",
      "https://fsbo.example.com/listings/123-mock-st",
    ];
  }

  async scrape(url: string, opts: ScrapeOptions = {}): Promise<ScrapeResult> {
    assertPermitted(url);
    const markdown = fixtureMarkdown(url);
    const result: ScrapeResult = { url, title: "Property record", markdown };
    if (opts.schema) result.json = await this.extractor.extract(markdown, opts.schema);
    return result;
  }

  async search(_query: string, opts: SearchOptions = {}): Promise<ScrapeResult[]> {
    const urls = this.searchResults
      .filter((u) => isPermitted(u))
      .slice(0, opts.limit ?? this.searchResults.length);
    return Promise.all(urls.map((u) => this.scrape(u, opts)));
  }

  async crawl(seedUrl: string, opts: CrawlOptions = {}): Promise<ScrapeResult[]> {
    assertPermitted(seedUrl);
    const max = opts.maxPages ?? 1;
    return [await this.scrape(seedUrl, opts)].slice(0, max);
  }

  async batchScrape(urls: string[], opts: ScrapeOptions = {}): Promise<ScrapeResult[]> {
    const out: ScrapeResult[] = [];
    for (const url of urls) {
      if (!isPermitted(url)) continue;
      out.push(await this.scrape(url, opts));
    }
    return out;
  }
}
