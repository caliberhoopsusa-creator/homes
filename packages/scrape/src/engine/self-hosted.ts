// The real, self-hosted engine — no paid scrape API. Fetches pages itself with
// a polite client (UA, timeout, retry/backoff, per-host rate limit), honors
// robots.txt, enforces the compliance denylist before every request, then cleans
// HTML → markdown and runs the configured extractor.
//
// `fetch` is injected (defaults to global fetch) so the engine is unit-testable
// with no live network — per the testing rules.
import type {
  ScrapeEngine,
  ScrapeOptions,
  SearchOptions,
  CrawlOptions,
  ScrapeResult,
} from "../engine.js";
import { assertPermitted, isPermitted, parseRobots, robotsAllows } from "../compliance.js";
import { htmlToMarkdown, extractTitle } from "../html-to-markdown.js";
import { extractLinks, nextFrontier } from "../crawl.js";
import { createExtractor, type Extractor } from "../extract.js";

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

export interface SelfHostedEngineOptions {
  fetchFn?: FetchFn;
  extractor?: Extractor;
  userAgent?: string;
  /** Politeness delay between requests to the same host (ms). */
  rateLimitMs?: number;
  /** Per-request timeout (ms). */
  timeoutMs?: number;
  /** Retry attempts on transient failure. */
  retries?: number;
  /** Honor robots.txt (default true). */
  respectRobots?: boolean;
  /** Optional allowlist of permitted domains; empty = allow all but the denylist. */
  allowDomains?: string[];
  /**
   * A self-hosted JSON search endpoint (e.g. a SearXNG `format=json` URL).
   * `{q}` and `{n}` are substituted with the query and limit. Required for search().
   */
  searchUrlTemplate?: string;
}

function intEnv(name: string, fallback: number): number {
  const v = process.env[name];
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class SelfHostedScrapeEngine implements ScrapeEngine {
  private readonly fetchFn: FetchFn;
  private readonly extractor: Extractor;
  private readonly userAgent: string;
  private readonly rateLimitMs: number;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly respectRobots: boolean;
  private readonly allow: string[];
  private readonly searchUrlTemplate?: string;

  // Per-host bookkeeping for politeness + robots caching.
  private readonly lastHit = new Map<string, number>();
  private readonly robotsCache = new Map<string, { disallow: string[] }>();

  constructor(opts: SelfHostedEngineOptions = {}) {
    const injected = opts.fetchFn ?? (globalThis as { fetch?: FetchFn }).fetch;
    if (!injected) {
      throw new Error("SelfHostedScrapeEngine: no fetch available; inject opts.fetchFn.");
    }
    this.fetchFn = injected;
    this.extractor = opts.extractor ?? createExtractor();
    this.userAgent =
      opts.userAgent ?? process.env.SCRAPE_USER_AGENT ?? "ParcelBot/1.0 (+compliant-sourcing)";
    this.rateLimitMs = opts.rateLimitMs ?? intEnv("SCRAPE_RATE_LIMIT_MS", 1000);
    this.timeoutMs = opts.timeoutMs ?? intEnv("SCRAPE_TIMEOUT_MS", 15000);
    this.retries = opts.retries ?? intEnv("SCRAPE_RETRIES", 2);
    this.respectRobots =
      opts.respectRobots ?? process.env.SCRAPE_RESPECT_ROBOTS !== "false";
    this.allow =
      opts.allowDomains ??
      (process.env.SCRAPE_ALLOW_DOMAINS
        ? process.env.SCRAPE_ALLOW_DOMAINS.split(",").map((d) => d.trim()).filter(Boolean)
        : []);
    this.searchUrlTemplate = opts.searchUrlTemplate ?? process.env.SCRAPE_SEARCH_URL;
  }

  async scrape(url: string, opts: ScrapeOptions = {}): Promise<ScrapeResult> {
    assertPermitted(url, this.allow);
    if (this.respectRobots && !(await this.robotsPermits(url))) {
      throw new Error(`Scrape refused: robots.txt disallows "${url}".`);
    }
    const html = await this.getHtml(url, opts.timeoutMs);
    const markdown = htmlToMarkdown(html);
    const result: ScrapeResult = { url, markdown };
    const title = extractTitle(html);
    if (title) result.title = title;
    if (opts.schema) result.json = await this.extractor.extract(markdown, opts.schema);
    return result;
  }

  async search(query: string, opts: SearchOptions = {}): Promise<ScrapeResult[]> {
    if (!this.searchUrlTemplate) {
      throw new Error(
        "SelfHostedScrapeEngine.search: no SCRAPE_SEARCH_URL configured. " +
          "Point it at a self-hosted JSON search endpoint (e.g. SearXNG format=json).",
      );
    }
    const limit = opts.limit ?? 25;
    const searchUrl = this.searchUrlTemplate
      .replace("{q}", encodeURIComponent(query))
      .replace("{n}", String(limit));
    const res = await this.fetchWithRetry(searchUrl, opts.timeoutMs);
    const body = (await res.json()) as { results?: Array<{ url?: string }> };
    const urls = (body.results ?? [])
      .map((r) => r.url)
      .filter((u): u is string => typeof u === "string" && isPermitted(u, this.allow))
      .slice(0, limit);
    return this.batchScrape(urls, opts);
  }

  async crawl(seedUrl: string, opts: CrawlOptions = {}): Promise<ScrapeResult[]> {
    assertPermitted(seedUrl, this.allow);
    const maxPages = opts.maxPages ?? 20;
    const maxDepth = opts.maxDepth ?? 2;

    const results: ScrapeResult[] = [];
    const seen = new Set<string>([seedUrl]);
    let frontier: Array<{ url: string; depth: number }> = [{ url: seedUrl, depth: 0 }];

    while (frontier.length > 0 && results.length < maxPages) {
      const next: Array<{ url: string; depth: number }> = [];
      for (const { url, depth } of frontier) {
        if (results.length >= maxPages) break;
        let html: string;
        try {
          if (this.respectRobots && !(await this.robotsPermits(url))) continue;
          html = await this.getHtml(url, opts.timeoutMs);
        } catch {
          continue; // skip failed pages, keep crawling
        }
        const markdown = htmlToMarkdown(html);
        const result: ScrapeResult = { url, markdown };
        const title = extractTitle(html);
        if (title) result.title = title;
        if (opts.schema) result.json = await this.extractor.extract(markdown, opts.schema);
        results.push(result);

        if (depth < maxDepth) {
          const links = nextFrontier(extractLinks(html, url), seedUrl, seen, this.allow);
          for (const link of links) {
            seen.add(link);
            next.push({ url: link, depth: depth + 1 });
          }
        }
      }
      frontier = next;
    }
    return results.slice(0, maxPages);
  }

  async batchScrape(urls: string[], opts: ScrapeOptions = {}): Promise<ScrapeResult[]> {
    const out: ScrapeResult[] = [];
    for (const url of urls) {
      if (!isPermitted(url, this.allow)) continue;
      try {
        out.push(await this.scrape(url, opts));
      } catch {
        // skip denied/failed pages, don't fail the batch
      }
    }
    return out;
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private async getHtml(url: string, timeoutMs?: number): Promise<string> {
    const res = await this.fetchWithRetry(url, timeoutMs);
    return res.text();
  }

  /** Fetch with per-host politeness delay, timeout, and bounded retry/backoff. */
  private async fetchWithRetry(url: string, timeoutMs?: number): Promise<Response> {
    const host = new URL(url).hostname;
    await this.throttle(host);

    let lastErr: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const res = await this.doFetch(url, timeoutMs);
        if (res.ok) return res;
        // Retry on 429 / 5xx only.
        if (res.status !== 429 && res.status < 500) {
          throw new Error(`Scrape fetch ${res.status} ${res.statusText} for ${url}`);
        }
        lastErr = new Error(`Scrape fetch ${res.status} ${res.statusText} for ${url}`);
      } catch (err) {
        lastErr = err;
      }
      if (attempt < this.retries) await sleep(this.rateLimitMs * Math.pow(2, attempt));
    }
    throw lastErr instanceof Error ? lastErr : new Error(`Scrape fetch failed for ${url}`);
  }

  private async doFetch(url: string, timeoutMs?: number): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs ?? this.timeoutMs);
    try {
      return await this.fetchFn(url, {
        headers: { "user-agent": this.userAgent, accept: "text/html,application/xhtml+xml" },
        signal: controller.signal,
        redirect: "follow",
      });
    } finally {
      clearTimeout(timer);
    }
  }

  /** Enforce a minimum gap between hits to the same host. */
  private async throttle(host: string): Promise<void> {
    const last = this.lastHit.get(host);
    const now = Date.now();
    if (last !== undefined) {
      const wait = this.rateLimitMs - (now - last);
      if (wait > 0) await sleep(wait);
    }
    this.lastHit.set(host, Date.now());
  }

  /** Fetch + cache robots.txt for the URL's host, then check the path. */
  private async robotsPermits(url: string): Promise<boolean> {
    const origin = new URL(url).origin;
    let rules = this.robotsCache.get(origin);
    if (!rules) {
      try {
        const res = await this.doFetch(`${origin}/robots.txt`);
        rules = res.ok ? parseRobots(await res.text(), "parcelbot") : { disallow: [] };
      } catch {
        rules = { disallow: [] }; // no robots → allowed
      }
      this.robotsCache.set(origin, rules);
    }
    return robotsAllows(rules, url);
  }
}
