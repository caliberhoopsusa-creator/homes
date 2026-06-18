import { describe, it, expect } from "vitest";
import type { Property, UnderwriteInsert } from "@parcel/types";
import { runUnderwriting, type UnderwriteStore } from "../src/run.js";
import { estimateInputs, REPAIRS_PER_SQFT } from "../src/estimate.js";
import { MockCompsProvider } from "../src/comps-provider.js";

function prop(p: Partial<Property>): Property {
  return {
    id: "p1",
    source: "batchdata",
    source_id: "x",
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
    est_value: 300_000,
    asking: null,
    distress_signals: ["absentee"],
    created_at: "2026-01-01T00:00:00Z",
    ...p,
  };
}

class FakeStore implements UnderwriteStore {
  rows: UnderwriteInsert[] = [];
  constructor(private props: Property[]) {}
  async propertiesNeedingUnderwrite() {
    return this.props;
  }
  async insertUnderwrite(row: UnderwriteInsert) {
    this.rows.push(row);
  }
}

describe("estimateInputs()", () => {
  it("derives arv from est_value and repairs from sqft heuristic", () => {
    const e = estimateInputs(prop({ est_value: 250_000, sqft: 1000 }));
    expect(e.arv).toBe(250_000);
    expect(e.repairs).toBe(1000 * REPAIRS_PER_SQFT);
    expect(e.isEstimate).toBe(true);
  });

  it("falls back asking to est_value when not listed", () => {
    const e = estimateInputs(prop({ est_value: 200_000, asking: null }));
    expect(e.asking).toBe(200_000);
  });

  it("uses fallback sqft and zero arv/asking when provider returns nulls", () => {
    const e = estimateInputs(prop({ est_value: null, sqft: null, asking: null }));
    expect(e.arv).toBe(0);
    expect(e.asking).toBe(0);
    // 1400 fallback sqft * heuristic
    expect(e.repairs).toBe(1400 * REPAIRS_PER_SQFT);
  });
});

describe("runUnderwriting()", () => {
  it("writes one underwrite row per property and tallies verdicts", async () => {
    const store = new FakeStore([
      prop({ id: "a", est_value: 400_000, sqft: 1000, asking: 150_000 }), // clear
      prop({ id: "b", est_value: 200_000, sqft: 1000, asking: 200_000 }), // pass
    ]);
    const tally = await runUnderwriting(store);
    expect(store.rows).toHaveLength(2);
    expect(tally.clear + tally.thin + tally.pass).toBe(2);
    expect(store.rows.every((r) => r.is_estimate === true)).toBe(true);
    expect(store.rows.every((r) => r.comp_count === 0)).toBe(true);
  });

  it("uses comps-backed ARV (is_estimate=false, comp_count>0) when a provider yields comps", async () => {
    // Subject needs geo + sqft for the mock provider to emit comps.
    const store = new FakeStore([
      prop({ id: "geo", lat: 46.87, lng: -113.99, sqft: 1500, est_value: 350_000 }),
    ]);
    const tally = await runUnderwriting(store, { compsProvider: new MockCompsProvider() });
    expect(store.rows).toHaveLength(1);
    const row = store.rows[0]!;
    expect(row.is_estimate).toBe(false);
    expect(row.comp_count).toBeGreaterThan(0);
    expect(row.arv).toBeGreaterThan(0);
    expect(tally.clear + tally.thin + tally.pass).toBe(1);
  });

  it("falls back to the heuristic when the subject lacks geo for comps", async () => {
    const store = new FakeStore([prop({ id: "nogeo", lat: null, lng: null })]);
    await runUnderwriting(store, { compsProvider: new MockCompsProvider() });
    expect(store.rows[0]!.is_estimate).toBe(true);
    expect(store.rows[0]!.comp_count).toBe(0);
  });
});
