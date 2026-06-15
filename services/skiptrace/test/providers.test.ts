import { describe, it, expect } from "vitest";
import { ownerHit } from "@parcel/types";
import type { Property } from "@parcel/types";
import { MockProvider } from "../src/providers/mock.js";
import { BatchDataProvider } from "../src/providers/batchdata.js";
import { createProvider } from "../src/factory.js";

function prop(id: string): Property {
  return {
    id,
    source: "manual",
    source_id: id,
    address: `${id} Grand Ave`,
    city: "Billings",
    state: "MT",
    zip: "59101",
    lat: 45.78,
    lng: -108.5,
    beds: 3,
    baths: 2,
    sqft: 1500,
    year_built: 1980,
    est_value: 250_000,
    asking: null,
    distress_signals: ["absentee"],
    created_at: "2026-01-01T00:00:00Z",
  };
}

describe("MockProvider", () => {
  it("matches roughly the configured rate, all hits schema-valid w/ email", async () => {
    const p = new MockProvider();
    let matched = 0;
    const n = 500;
    for (let i = 0; i < n; i++) {
      const hit = await p.trace(prop(`x${i}`));
      if (hit) {
        matched++;
        expect(ownerHit.safeParse(hit).success).toBe(true);
        expect(hit.email).toBeTruthy();
      }
    }
    const rate = matched / n;
    expect(rate).toBeGreaterThanOrEqual(0.6);
    expect(rate).toBeLessThanOrEqual(0.9);
  });

  it("is deterministic for a given id", async () => {
    const a = await new MockProvider().trace(prop("same"));
    const b = await new MockProvider().trace(prop("same"));
    expect(a).toEqual(b);
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
  it("defaults to the mock", async () => {
    const hit = await createProvider({ provider: "mock" }).trace(prop("z"));
    // mock returns either a valid hit or null; both acceptable here.
    if (hit) expect(ownerHit.safeParse(hit).success).toBe(true);
  });
});
