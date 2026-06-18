import { describe, it, expect } from "vitest";
import type {
  PropertyCandidate,
  PropertyInsert,
  PropertySource,
  RadiusPullRequest,
} from "@parcel/types";
import { runPull, type SourcingStore } from "../src/run.js";
import type { PropertyProvider } from "../src/provider.js";

const req: RadiusPullRequest = {
  lat: 45.78,
  lng: -108.5,
  radiusMiles: 10,
  filters: {},
};

function candidate(p: Partial<PropertyCandidate>): PropertyCandidate {
  return {
    source: "county",
    source_id: "j:1",
    address: "1 Main",
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
    distress_signals: ["tax_delinquent"],
    ...p,
  };
}

class FakeStore implements SourcingStore {
  rows: PropertyInsert[] = [];
  async existingSourceIds(_s: PropertySource) {
    return new Set<string>();
  }
  async insertProperties(rows: PropertyInsert[]) {
    this.rows.push(...rows);
    return rows.length;
  }
  async existingAddressIndex() {
    return [];
  }
  async mergeDistress() {}
}

const provider = (cands: PropertyCandidate[]): PropertyProvider => ({
  async search() {
    return cands;
  },
});

describe("runPull — region-sourced (null-coord) candidates", () => {
  it("inserts a null-coord candidate instead of dropping it on the radius filter", async () => {
    const store = new FakeStore();
    const r = await runPull(provider([candidate({})]), store, req);
    expect(r.inserted).toBe(1);
    expect(store.rows[0]!.source).toBe("county");
  });

  it("still radius-filters GEOCODED candidates outside the radius", async () => {
    const store = new FakeStore();
    const r = await runPull(
      provider([candidate({ source_id: "j:2", lat: 0, lng: 0 })]),
      store,
      req,
    );
    expect(r.inserted).toBe(0);
  });
});
