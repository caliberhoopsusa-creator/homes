import { describe, it, expect } from "vitest";
import { MockScrapeEngine } from "@parcel/scrape";
import { ScrapeProvider } from "../src/providers/scrape.js";
import type { Property } from "@parcel/types";

const PROPERTY: Property = {
  id: "p1",
  source: "scrape",
  source_id: "https://county.example.gov/p/1",
  address: "123 Mock St",
  city: "Billings",
  state: "MT",
  zip: "59101",
  lat: null,
  lng: null,
  beds: 3,
  baths: 2,
  sqft: 1450,
  year_built: 1978,
  est_value: 245000,
  asking: 190000,
  distress_signals: ["tax_delinquent"],
  created_at: new Date().toISOString(),
};

describe("skiptrace ScrapeProvider", () => {
  it("resolves owner contact from a permitted scraped record", async () => {
    const provider = new ScrapeProvider({ engine: new MockScrapeEngine() });
    const hit = await provider.trace(PROPERTY);

    expect(hit).not.toBeNull();
    expect(hit!.email).toBe("jane.owner@example.com");
    expect(hit!.phone).toMatch(/555.?0142/);
    // email + phone found → confidence above the fuzzy base.
    expect(hit!.confidence).toBeGreaterThan(0.55);
    expect(hit!.confidence).toBeLessThanOrEqual(1);
  });

  it("returns null when no contact fields are extractable", async () => {
    const engine = new MockScrapeEngine({ searchResults: [] });
    const hit = await new ScrapeProvider({ engine }).trace(PROPERTY);
    expect(hit).toBeNull();
  });
});
