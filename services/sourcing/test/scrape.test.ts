import { describe, it, expect } from "vitest";
import { MockScrapeEngine } from "@parcel/scrape";
import { ScrapeProvider } from "../src/providers/scrape.js";
import type { RadiusPullRequest } from "@parcel/types";

const REQ: RadiusPullRequest = {
  lat: 45.78,
  lng: -108.5,
  radiusMiles: 10,
  filters: { distress: ["tax_delinquent"] },
};

describe("sourcing ScrapeProvider", () => {
  it("maps engine results into PropertyCandidate rows tagged source=scrape", async () => {
    const provider = new ScrapeProvider({ engine: new MockScrapeEngine() });
    const candidates = await provider.search(REQ);

    expect(candidates.length).toBeGreaterThan(0);
    const c = candidates[0]!;
    expect(c.source).toBe("scrape");
    expect(c.source_id).toMatch(/^https:\/\//); // the page URL is the dedupe id
    expect(c.beds).toBe(3);
    expect(c.baths).toBe(2);
    expect(c.sqft).toBe(1450);
    expect(c.year_built).toBe(1978);
    expect(c.est_value).toBe(245000);
    expect(c.asking).toBe(190000);
    // No distress pattern extracted → falls back to the request's filter intent.
    expect(c.distress_signals).toContain("tax_delinquent");
  });

  it("does not return denied-domain results (engine enforces the denylist)", async () => {
    const engine = new MockScrapeEngine({
      searchResults: ["https://zillow.com/listing/1", "https://county.example.gov/p/1"],
    });
    const candidates = await new ScrapeProvider({ engine }).search(REQ);
    expect(candidates.every((c) => !String(c.source_id).includes("zillow"))).toBe(true);
    expect(candidates).toHaveLength(1);
  });
});
