import { describe, it, expect } from "vitest";
import type {
  PropertyInsert,
  PropertySource,
  RadiusPullRequest,
} from "@parcel/types";
import { runPull, type SourcingStore } from "../src/run.js";
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
  rows: PropertyInsert[] = [];

  async existingSourceIds(source: PropertySource): Promise<Set<string>> {
    const ids = new Set<string>();
    for (const r of this.rows) {
      if (r.source === source && r.source_id) ids.add(r.source_id);
    }
    return ids;
  }

  async insertProperties(rows: PropertyInsert[]): Promise<number> {
    this.rows.push(...rows);
    return rows.length;
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
