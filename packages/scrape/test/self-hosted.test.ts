import { describe, it, expect, vi } from "vitest";
import { SelfHostedScrapeEngine } from "../src/engine/self-hosted.js";
import type { ExtractSchema } from "../src/engine.js";

const SCHEMA: ExtractSchema = {
  type: "object",
  properties: { zip: { type: "string" }, beds: { type: "number" } },
};

/** Build a fetch stub from a url→html map; serves empty robots.txt by default. */
function fakeFetch(pages: Record<string, string>, robots = "") {
  return vi.fn(async (url: string) => {
    if (url.endsWith("/robots.txt")) return new Response(robots, { status: 200 });
    const body = pages[url];
    if (body === undefined) return new Response("not found", { status: 404 });
    return new Response(body, { status: 200, headers: { "content-type": "text/html" } });
  });
}

const HOME = "https://county-records.example.gov/parcels/1";
const PAGE_HTML =
  "<title>Parcel 1</title><body><main><h1>Parcel</h1>" +
  "<p>59101. 3 bed home.</p>" +
  '<a href="/parcels/2">next</a>' +
  '<a href="https://zillow.com/x">denied</a></body>';

describe("SelfHostedScrapeEngine.scrape", () => {
  it("fetches, cleans to markdown, and extracts schema json", async () => {
    const engine = new SelfHostedScrapeEngine({
      fetchFn: fakeFetch({ [HOME]: PAGE_HTML }),
      rateLimitMs: 0,
    });
    const r = await engine.scrape(HOME, { schema: SCHEMA });
    expect(r.title).toBe("Parcel 1");
    expect(r.markdown).toMatch(/# Parcel/);
    expect(r.json).toMatchObject({ zip: "59101", beds: 3 });
  });

  it("refuses denied domains before any fetch", async () => {
    const fetchFn = fakeFetch({});
    const engine = new SelfHostedScrapeEngine({ fetchFn, rateLimitMs: 0 });
    await expect(engine.scrape("https://zillow.com/x")).rejects.toThrow(/not a permitted source/);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("honors robots.txt disallow", async () => {
    const engine = new SelfHostedScrapeEngine({
      fetchFn: fakeFetch({ [HOME]: PAGE_HTML }, "User-agent: *\nDisallow: /parcels"),
      rateLimitMs: 0,
    });
    await expect(engine.scrape(HOME)).rejects.toThrow(/robots\.txt/);
  });

  it("retries on 5xx then succeeds", async () => {
    let calls = 0;
    const fetchFn = vi.fn(async (url: string) => {
      if (url.endsWith("/robots.txt")) return new Response("", { status: 200 });
      calls++;
      if (calls === 1) return new Response("boom", { status: 503 });
      return new Response("<body><p>ok</p></body>", { status: 200 });
    });
    const engine = new SelfHostedScrapeEngine({ fetchFn, rateLimitMs: 0, retries: 2 });
    const r = await engine.scrape(HOME);
    expect(r.markdown).toBe("ok");
    expect(calls).toBe(2);
  });
});

describe("SelfHostedScrapeEngine.crawl", () => {
  it("follows same-host permitted links and skips denied ones", async () => {
    const page2 = "https://county-records.example.gov/parcels/2";
    const engine = new SelfHostedScrapeEngine({
      fetchFn: fakeFetch({
        [HOME]: PAGE_HTML,
        [page2]: "<body><main><p>second parcel</p></main></body>",
      }),
      rateLimitMs: 0,
    });
    const results = await engine.crawl(HOME, { maxPages: 10, maxDepth: 1 });
    const urls = results.map((r) => r.url);
    expect(urls).toContain(HOME);
    expect(urls).toContain(page2);
    expect(urls.some((u) => u.includes("zillow"))).toBe(false);
  });

  it("respects maxPages", async () => {
    const page2 = "https://county-records.example.gov/parcels/2";
    const engine = new SelfHostedScrapeEngine({
      fetchFn: fakeFetch({ [HOME]: PAGE_HTML, [page2]: "<body><p>two</p></body>" }),
      rateLimitMs: 0,
    });
    const results = await engine.crawl(HOME, { maxPages: 1, maxDepth: 3 });
    expect(results).toHaveLength(1);
  });
});

describe("SelfHostedScrapeEngine.search", () => {
  it("throws a helpful error when no search endpoint is configured", async () => {
    const engine = new SelfHostedScrapeEngine({ fetchFn: fakeFetch({}), rateLimitMs: 0 });
    await expect(engine.search("anything")).rejects.toThrow(/SCRAPE_SEARCH_URL/);
  });

  it("queries the configured endpoint and scrapes permitted results", async () => {
    const searchUrl = "https://searx.example.com/search?q={q}&n={n}&format=json";
    const resolved = "https://searx.example.com/search?q=tax%20delinquent&n=10&format=json";
    const fetchFn = vi.fn(async (url: string) => {
      if (url.endsWith("/robots.txt")) return new Response("", { status: 200 });
      if (url === resolved) {
        return new Response(
          JSON.stringify({ results: [{ url: HOME }, { url: "https://zillow.com/x" }] }),
          { status: 200 },
        );
      }
      if (url === HOME) return new Response(PAGE_HTML, { status: 200 });
      return new Response("nf", { status: 404 });
    });
    const engine = new SelfHostedScrapeEngine({
      fetchFn,
      rateLimitMs: 0,
      searchUrlTemplate: searchUrl,
    });
    const results = await engine.search("tax delinquent", { limit: 10 });
    expect(results).toHaveLength(1);
    expect(results[0]?.url).toBe(HOME);
  });
});
