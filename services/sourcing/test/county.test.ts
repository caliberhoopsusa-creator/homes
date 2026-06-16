import { describe, it, expect, vi, afterEach } from "vitest";
import type { RadiusPullRequest } from "@parcel/types";
import {
  CountyRecordsProvider,
  type CountySource,
  type FetchLike,
} from "../src/providers/county.js";

const req: RadiusPullRequest = {
  lat: 45.78,
  lng: -108.5,
  radiusMiles: 25,
  filters: {},
};

/** A fetch stub that returns canned JSON per URL. */
function fetchStub(byUrl: Record<string, unknown>, ok = true, status = 200): FetchLike {
  return vi.fn(async (url: string) => ({
    ok,
    status,
    statusText: "ERR",
    json: async () => byUrl[url] ?? [],
  }));
}

afterEach(() => vi.unstubAllEnvs());

const taxSource: CountySource = {
  url: "https://yellowstone.county.gov/tax-delinquent.json",
  distress: "tax_delinquent",
  jurisdiction: "Yellowstone County, MT",
};
const probateSource: CountySource = {
  url: "https://yellowstone.county.gov/probate.json",
  distress: "probate" as never, // not in the enum → normalizeDistress drops it (tested below)
  jurisdiction: "Yellowstone County, MT",
};

describe("CountyRecordsProvider", () => {
  it("maps normalized county records to candidates with source 'county' + distress tag", async () => {
    const provider = new CountyRecordsProvider({
      sources: [taxSource],
      fetchImpl: fetchStub({
        [taxSource.url]: [
          { record_id: "R-1", address: "1 Main St", city: "Billings", state: "MT", zip: "59101", beds: 3 },
          { record_id: "R-2", address: "2 Oak Ave", city: "Billings", state: "MT", zip: "59102" },
        ],
      }),
    });

    const out = await provider.search(req);
    expect(out).toHaveLength(2);
    expect(out[0]!.source).toBe("county");
    expect(out[0]!.source_id).toBe("Yellowstone County, MT:R-1");
    expect(out[0]!.address).toBe("1 Main St");
    expect(out[0]!.lat).toBeNull(); // county records aren't geocoded
    expect(out[0]!.distress_signals).toContain("tax_delinquent");
  });

  it("skips records with no address and falls back source_id to the address", async () => {
    const provider = new CountyRecordsProvider({
      sources: [taxSource],
      fetchImpl: fetchStub({
        [taxSource.url]: [{ address: "3 Pine Rd" }, { address: "" }, {}],
      }),
    });
    const out = await provider.search(req);
    expect(out).toHaveLength(1);
    expect(out[0]!.source_id).toBe("Yellowstone County, MT:3 Pine Rd");
  });

  it("drops ToS-denied source domains (no scraping Zillow/Redfin)", async () => {
    const denied: CountySource = {
      url: "https://www.zillow.com/whatever.json",
      distress: "vacant",
      jurisdiction: "X",
    };
    const stub = fetchStub({ [taxSource.url]: [{ address: "1 Main St" }] });
    const provider = new CountyRecordsProvider({ sources: [denied, taxSource], fetchImpl: stub });
    const out = await provider.search(req);
    // only the permitted source contributed; zillow was never fetched
    expect(out).toHaveLength(1);
    expect(stub).toHaveBeenCalledTimes(1);
  });

  it("throws when no sources are configured", () => {
    vi.stubEnv("COUNTY_RECORDS_SOURCES", "");
    expect(() => new CountyRecordsProvider({})).toThrow(/COUNTY_RECORDS_SOURCES/);
  });

  it("reads sources from COUNTY_RECORDS_SOURCES env (JSON)", () => {
    vi.stubEnv("COUNTY_RECORDS_SOURCES", JSON.stringify([taxSource]));
    expect(() => new CountyRecordsProvider({ fetchImpl: fetchStub({}) })).not.toThrow();
  });

  it("throws on a non-ok response", async () => {
    const provider = new CountyRecordsProvider({
      sources: [taxSource],
      fetchImpl: fetchStub({}, false, 503),
    });
    await expect(provider.search(req)).rejects.toThrow(/CountyRecordsProvider/);
  });

  it("normalizeDistress drops an unknown distress label (probate not in enum)", async () => {
    const provider = new CountyRecordsProvider({
      sources: [probateSource],
      fetchImpl: fetchStub({ [probateSource.url]: [{ address: "9 Elm" }] }),
    });
    const out = await provider.search(req);
    expect(out[0]!.distress_signals).toEqual([]);
  });
});
