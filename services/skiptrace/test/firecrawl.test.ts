import { describe, it, expect, vi, afterEach } from "vitest";
import type { Property } from "@parcel/types";
import { FirecrawlProvider } from "../src/providers/firecrawl.js";

const property: Property = {
  id: "p1",
  source: "firecrawl",
  source_id: "u",
  address: "123 Main St",
  city: "Billings",
  state: "MT",
  zip: "59101",
  lat: null,
  lng: null,
  beds: 3,
  baths: 2,
  sqft: 1500,
  year_built: 1980,
  est_value: 200000,
  asking: null,
  distress_signals: ["absentee"],
  created_at: "2026-01-01T00:00:00Z",
};

function stubFetch(payload: unknown, ok = true, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok,
      status,
      statusText: "ERR",
      headers: { get: () => null },
      json: async () => payload,
    })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("skiptrace FirecrawlProvider", () => {
  it("maps an extracted owner into an OwnerHit with scaled confidence", async () => {
    stubFetch({
      data: {
        web: [
          {
            url: "https://assessor.county.gov/parcel/1",
            json: {
              full_name: "Jane Doe",
              email: "jane@example.com",
              phone: "406-555-1212",
              mailing_address: "PO Box 1, Billings, MT",
            },
          },
        ],
      },
    });
    const p = new FirecrawlProvider({ apiKey: "fc-test", baseConfidence: 0.5 });
    const hit = await p.trace(property);
    expect(hit?.full_name).toBe("Jane Doe");
    expect(hit?.email).toBe("jane@example.com");
    // 4 fields found → 0.5 + 0.1*3 = 0.8
    expect(hit?.confidence).toBeCloseTo(0.8, 5);
  });

  it("skips ToS-denied domains and returns null when no contact is found", async () => {
    stubFetch({
      data: { web: [{ url: "https://www.zillow.com/x", json: { full_name: "Nope" } }] },
    });
    const p = new FirecrawlProvider({ apiKey: "fc-test" });
    expect(await p.trace(property)).toBeNull();
  });

  it("throws without an API key", () => {
    vi.stubEnv("FIRECRAWL_API_KEY", "");
    expect(() => new FirecrawlProvider({})).toThrow(/FIRECRAWL_API_KEY/);
  });
});
