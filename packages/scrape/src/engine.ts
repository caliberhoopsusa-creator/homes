// The ScrapeEngine seam — a self-hosted, Firecrawl-shaped web scraper.
//
// An engine turns URLs (or a search query, or a crawl seed) into clean,
// structured results: markdown for humans/LLMs + optional schema-extracted JSON.
// Real engines sit behind this interface so they are mockable and opt-in (§7.4);
// the MockScrapeEngine is the keyless default.
//
// COMPLIANCE (PRD §8.4): every engine MUST refuse denied domains (Zillow/Redfin/
// Trulia/Realtor) before any network call. Enforcement lives in ./compliance and
// is applied at the engine boundary — not left to each caller.

/** A JSON-schema-ish shape describing the fields to extract from a page. */
export interface ExtractSchema {
  type: "object";
  properties: Record<string, { type: string; items?: { type: string } }>;
}

export interface ScrapeOptions {
  /** When set, ask the engine to return structured JSON matching this schema. */
  schema?: ExtractSchema;
  /** Per-request timeout override (ms). */
  timeoutMs?: number;
}

export interface SearchOptions extends ScrapeOptions {
  /** Max results to return. */
  limit?: number;
  /** Bias the query toward a place (text search alone is weak on lat/lng). */
  region?: string;
}

export interface CrawlOptions extends ScrapeOptions {
  /** Max pages to fetch across the crawl. */
  maxPages?: number;
  /** How many links deep to follow from the seed. */
  maxDepth?: number;
}

/** One scraped page: always markdown, optionally raw html + extracted json. */
export interface ScrapeResult {
  url: string;
  title?: string;
  /** Clean, main-content markdown (scripts/styles/nav stripped). */
  markdown: string;
  /** Raw fetched html, if the caller asked to keep it. */
  html?: string;
  /** Schema-extracted structured data, when a schema was provided. */
  json?: Record<string, unknown>;
}

export interface ScrapeEngine {
  /** Fetch + clean a single permitted URL into a ScrapeResult. */
  scrape(url: string, opts?: ScrapeOptions): Promise<ScrapeResult>;
  /** Search the web and scrape each permitted result. */
  search(query: string, opts?: SearchOptions): Promise<ScrapeResult[]>;
  /** Crawl from a seed URL within its (permitted) domain. */
  crawl(seedUrl: string, opts?: CrawlOptions): Promise<ScrapeResult[]>;
  /** Scrape many permitted URLs; denied/failed ones are skipped, not thrown. */
  batchScrape(urls: string[], opts?: ScrapeOptions): Promise<ScrapeResult[]>;
}
