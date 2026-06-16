import { describe, it, expect, vi, afterEach } from "vitest";
import type { RadiusPullRequest } from "@parcel/types";
import { FirecrawlProvider } from "../src/providers/firecrawl.js";

const req: RadiusPullRequest = {
  lat: 45.78,
  lng: -108.5,
  radiusMiles: 10,
  filters: { distress: ["tax_delinquent"] },
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

describe("sourcing FirecrawlProvider", () => {
  it("maps permitted results to candidates and drops ToS-denied domains", async () => {
    stubFetch({
      data: {
        web: [
          {
            url: "https://county.gov/tax/123",
            title: "123 Main",
            json: {
              address: "123 Main St",
              city: "Billings",
              state: "MT",
              zip: "59101",
              beds: 3,
              distress_signals: ["tax_delinquent"],
            },
          },
          // Must be dropped — scraping Zillow violates ToS (PRD §8.4).
          { url: "https://www.zillow.com/homedetails/999", title: "999", json: { address: "999 No St" } },
        ],
      },
    });

    const p = new FirecrawlProvider({ apiKey: "fc-test" });
    const out = await p.search(req);

    expect(out).toHaveLength(1);
    expect(out[0]!.source).toBe("firecrawl");
    expect(out[0]!.source_id).toBe("https://county.gov/tax/123");
    expect(out[0]!.address).toBe("123 Main St");
    expect(out[0]!.distress_signals).toContain("tax_delinquent");
  });

  it("honors an allowlist when provided", async () => {
    stubFetch({
      data: {
        web: [
          { url: "https://allowed.gov/p/1", json: { address: "1 A St" } },
          { url: "https://random-blog.com/p/2", json: { address: "2 B St" } },
        ],
      },
    });
    const p = new FirecrawlProvider({ apiKey: "fc-test", allowDomains: ["allowed.gov"] });
    const out = await p.search(req);
    expect(out.map((c) => c.address)).toEqual(["1 A St"]);
  });

  it("throws without an API key", () => {
    vi.stubEnv("FIRECRAWL_API_KEY", "");
    expect(() => new FirecrawlProvider({})).toThrow(/FIRECRAWL_API_KEY/);
  });

  it("throws on a non-ok response", async () => {
    stubFetch({}, false, 500);
    const p = new FirecrawlProvider({ apiKey: "fc-test" });
    await expect(p.search(req)).rejects.toThrow(/Firecrawl/);
  });
});
