import { describe, it, expect } from "vitest";
import { MockScrapeEngine } from "../src/engine/mock.js";
import { createScrapeEngine } from "../src/factory.js";
import type { ExtractSchema } from "../src/engine.js";

const SCHEMA: ExtractSchema = {
  type: "object",
  properties: { email: { type: "string" }, beds: { type: "number" } },
};

describe("MockScrapeEngine", () => {
  const engine = new MockScrapeEngine();

  it("scrapes a permitted url to markdown + schema json", async () => {
    const r = await engine.scrape("https://county-records.example.gov/p/1", { schema: SCHEMA });
    expect(r.markdown).toMatch(/Property record/);
    expect(r.json?.email).toBe("jane.owner@example.com");
    expect(r.json?.beds).toBe(3);
  });

  it("refuses a denied url even in mock mode", async () => {
    await expect(engine.scrape("https://zillow.com/x")).rejects.toThrow(/not a permitted source/);
  });

  it("search returns deterministic permitted results within the limit", async () => {
    const results = await engine.search("tax delinquent billings", { limit: 1 });
    expect(results).toHaveLength(1);
    expect(results[0]?.url).toMatch(/^https:\/\//);
  });

  it("batchScrape silently skips denied urls", async () => {
    const results = await engine.batchScrape([
      "https://county-records.example.gov/p/1",
      "https://redfin.com/x",
    ]);
    expect(results).toHaveLength(1);
  });
});

describe("createScrapeEngine", () => {
  it("defaults to the mock and rejects unknown engines", () => {
    expect(createScrapeEngine({ engine: "mock" })).toBeInstanceOf(MockScrapeEngine);
    // @ts-expect-error testing the runtime guard
    expect(() => createScrapeEngine({ engine: "bogus" })).toThrow(/Unknown SCRAPE_ENGINE/);
  });
});
