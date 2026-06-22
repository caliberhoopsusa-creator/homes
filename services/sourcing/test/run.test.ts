import { describe, it, expect } from "vitest";
import type {
  DistressSignal,
  PropertyInsert,
  PropertySource,
  RadiusPullRequest,
} from "@parcel/types";
import {
  runPull,
  type AddressIndexRow,
  type SourcingStore,
} from "../src/run.js";
import { MockProvider, MOCK_CENTER } from "../src/providers/mock.js";
import { CachingProvider } from "../src/cache.js";

const REQ: RadiusPullRequest = {
  lat: MOCK_CENTER.lat,
  lng: MOCK_CENTER.lng,
  radiusMiles: 25,
  filters: {},
};

/** In-memory store that accumulates inserted rows and dedupes on source+id. */
class FakeStore implements SourcingStore {
  rows: (PropertyInsert & { id: string })[] = [];
  private seq = 0;

  async existingSourceIds(source: PropertySource): Promise<Set<string>> {
    const ids = new Set<string>();
    for (const r of this.rows) {
      if (r.source === source && r.source_id) ids.add(r.source_id);
    }
    return ids;
  }

  async insertProperties(rows: PropertyInsert[]): Promise<number> {
    for (const r of rows) {
      this.seq += 1;
      this.rows.push({ ...r, id: `row-${this.seq}` });
    }
    return rows.length;
  }

  async existingAddressIndex(): Promise<AddressIndexRow[]> {
    return this.rows.map((r) => ({
      id: r.id,
      address: r.address,
      distress_signals: r.distress_signals ?? null,
    }));
  }

  async mergeDistress(id: string, signals: DistressSignal[]): Promise<void> {
    const row = this.rows.find((r) => r.id === id);
    if (row) row.distress_signals = signals;
  }
}

describe("runPull() against the mock provider", () => {
  it("yields >= 500 deduped, in-radius rows", async () => {
    const store = new FakeStore();
    const res = await runPull(new MockProvider(), store, REQ);

    expect(res.inserted).toBeGreaterThanOrEqual(500);
    expect(store.rows.length).toBe(res.inserted);
  });

  it("re-running the same pull inserts no duplicates", async () => {
    const store = new FakeStore();
    const first = await runPull(new MockProvider(), store, REQ);
    const second = await runPull(new MockProvider(), store, REQ);

    expect(first.inserted).toBeGreaterThanOrEqual(500);
    expect(second.inserted).toBe(0);
    expect(store.rows.length).toBe(first.inserted);
  });

  it("every inserted row carries >= 1 distress tag", async () => {
    const store = new FakeStore();
    await runPull(new MockProvider(), store, REQ);

    expect(store.rows.length).toBeGreaterThan(0);
    expect(
      store.rows.every((r) => (r.distress_signals?.length ?? 0) >= 1),
    ).toBe(true);
  });

  it("is deterministic: two providers produce identical counts", async () => {
    const a = new FakeStore();
    const b = new FakeStore();
    const ra = await runPull(new MockProvider(), a, REQ);
    const rb = await runPull(new MockProvider(), b, REQ);
    expect(ra.inserted).toBe(rb.inserted);
  });

  it("respects the minBeds and distress filters", async () => {
    const store = new FakeStore();
    await runPull(new MockProvider(), store, {
      ...REQ,
      filters: { minBeds: 4, distress: ["vacant"] },
    });

    expect(store.rows.length).toBeGreaterThan(0);
    expect(store.rows.every((r) => (r.beds ?? 0) >= 4)).toBe(true);
    expect(
      store.rows.every((r) => r.distress_signals?.includes("vacant")),
    ).toBe(true);
  });

  it("keeps everything inside the requested radius", async () => {
    const store = new FakeStore();
    const small: RadiusPullRequest = { ...REQ, radiusMiles: 5 };
    await runPull(new MockProvider(), store, small);
    // A 5-mile pull returns strictly fewer rows than a 25-mile pull.
    const big = new FakeStore();
    await runPull(new MockProvider(), big, REQ);
    expect(store.rows.length).toBeLessThan(big.rows.length);
  });
});

describe("runPull() list-stacking (cross-source dedupe by address)", () => {
  function cand(
    over: Partial<import("@parcel/types").PropertyCandidate> &
      Pick<import("@parcel/types").PropertyCandidate, "source" | "source_id" | "address" | "distress_signals">,
  ): import("@parcel/types").PropertyCandidate {
    return {
      city: "Billings",
      state: "MT",
      zip: "59101",
      lat: null,
      lng: null,
      beds: 3,
      baths: 2,
      sqft: 1500,
      year_built: 1980,
      est_value: 250_000,
      asking: null,
      ...over,
    };
  }
  const stub = (list: import("@parcel/types").PropertyCandidate[]) => ({
    search: async () => list,
  });

  it("collapses the same address from two lists into ONE row with both signals", async () => {
    const store = new FakeStore();
    const res = await runPull(
      stub([
        cand({ source: "county", source_id: "tax-1", address: "1420 Beckwith Ave", distress_signals: ["tax_delinquent"] }),
        cand({ source: "manual", source_id: "code-9", address: "1420 Beckwith Avenue.", distress_signals: ["code_violation"] }),
      ]),
      store,
      REQ,
    );
    expect(res.inserted).toBe(1);
    expect(store.rows).toHaveLength(1);
    expect(new Set(store.rows[0]!.distress_signals)).toEqual(
      new Set(["tax_delinquent", "code_violation"]),
    );
  });

  it("merges a new list's signal into a property already on file (no duplicate)", async () => {
    const store = new FakeStore();
    await runPull(
      stub([cand({ source: "county", source_id: "tax-1", address: "44 Cooper St", distress_signals: ["tax_delinquent"] })]),
      store,
      REQ,
    );
    const res = await runPull(
      stub([cand({ source: "manual", source_id: "prob-2", address: "44 cooper street", distress_signals: ["probate"] })]),
      store,
      REQ,
    );
    expect(res.inserted).toBe(0);
    expect(res.stacked).toBe(1);
    expect(store.rows).toHaveLength(1);
    expect(new Set(store.rows[0]!.distress_signals)).toEqual(
      new Set(["tax_delinquent", "probate"]),
    );
  });

  it("does not re-write when the signal is already present (idempotent)", async () => {
    const store = new FakeStore();
    await runPull(
      stub([cand({ source: "county", source_id: "tax-1", address: "12 Rattlesnake Dr", distress_signals: ["tax_delinquent"] })]),
      store,
      REQ,
    );
    const res = await runPull(
      stub([cand({ source: "manual", source_id: "x-2", address: "12 Rattlesnake Drive", distress_signals: ["tax_delinquent"] })]),
      store,
      REQ,
    );
    expect(res.inserted).toBe(0);
    expect(res.stacked).toBe(0);
  });

  it("keeps a candidate with unknown beds even under a minBeds filter", async () => {
    // Cadastral/public-record leads often have no bed count — a missing field
    // must not silently drop a real lead.
    const store = new FakeStore();
    const res = await runPull(
      stub([
        cand({ source: "county", source_id: "c-1", address: "9 Absentee Way", distress_signals: ["absentee"], beds: null }),
      ]),
      store,
      { ...REQ, filters: { minBeds: 3, distress: ["absentee"] } },
    );
    expect(res.inserted).toBe(1);
    expect(store.rows[0]!.beds).toBeNull();
  });
});

describe("CachingProvider", () => {
  it("serves a repeated request from cache (one upstream call)", async () => {
    let calls = 0;
    const inner = new MockProvider();
    const counting = {
      search: (req: RadiusPullRequest) => {
        calls++;
        return inner.search(req);
      },
    };
    const cached = new CachingProvider(counting, { ttlMs: 10_000 });

    await cached.search(REQ);
    await cached.search(REQ);
    expect(calls).toBe(1);
  });
});
