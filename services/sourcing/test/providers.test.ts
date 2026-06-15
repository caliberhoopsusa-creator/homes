import { describe, it, expect } from "vitest";
import { propertyCandidate, type RadiusPullRequest } from "@parcel/types";
import { MockProvider, MOCK_CENTER } from "../src/providers/mock.js";
import { BatchDataProvider } from "../src/providers/batchdata.js";
import { createProvider } from "../src/factory.js";
import { normalizeDistress } from "../src/normalize.js";
import { haversineMiles } from "../src/geo.js";

const REQ: RadiusPullRequest = {
  lat: MOCK_CENTER.lat,
  lng: MOCK_CENTER.lng,
  radiusMiles: 25,
  filters: {},
};

describe("MockProvider", () => {
  it("emits schema-valid candidates each with >=1 distress signal", async () => {
    const cands = await new MockProvider().search(REQ);
    expect(cands.length).toBeGreaterThanOrEqual(500);
    for (const c of cands.slice(0, 50)) {
      expect(propertyCandidate.safeParse(c).success).toBe(true);
      expect(c.distress_signals.length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("BatchDataProvider", () => {
  it("throws a clear error when the key is missing", () => {
    expect(() => new BatchDataProvider(undefined)).toThrow(/BATCHDATA_API_KEY/);
  });

  it("constructs when a key is supplied", () => {
    expect(() => new BatchDataProvider("test-key")).not.toThrow();
  });
});

describe("createProvider()", () => {
  it("defaults to a working mock provider", async () => {
    const p = createProvider({ provider: "mock" });
    const cands = await p.search(REQ);
    expect(cands.length).toBeGreaterThanOrEqual(500);
  });
});

describe("normalizeDistress()", () => {
  it("maps aliases, dedupes, and drops junk", () => {
    expect(normalizeDistress(["Tax-Delinquent", "tax_delinquent", "nope"])).toEqual(
      ["tax_delinquent"],
    );
    expect(normalizeDistress(["pre-foreclosure"])).toEqual(["preforeclosure"]);
  });
});

describe("haversineMiles()", () => {
  it("is ~0 for identical points and positive otherwise", () => {
    expect(haversineMiles(45.78, -108.5, 45.78, -108.5)).toBeCloseTo(0, 5);
    expect(haversineMiles(45.78, -108.5, 45.88, -108.5)).toBeGreaterThan(5);
  });
});
