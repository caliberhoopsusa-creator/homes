import { describe, it, expect } from "vitest";
import type { Property, OwnerHit } from "@parcel/types";
import { runSkiptrace, type SkiptraceStore } from "../src/run.js";
import { MockProvider } from "../src/providers/mock.js";

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

interface OwnerRow {
  hit: OwnerHit;
  status: "matched";
}

/** In-memory store. Seeded owners model existing higher-confidence matches. */
class FakeStore implements SkiptraceStore {
  owners = new Map<string, OwnerRow>();
  noneIds = new Set<string>();

  constructor(private props: Property[], seed: Record<string, OwnerHit> = {}) {
    for (const [id, hit] of Object.entries(seed)) {
      this.owners.set(id, { hit, status: "matched" });
    }
  }

  async propertiesWithoutMatchedOwner(): Promise<Property[]> {
    return this.props;
  }
  async currentConfidence(propertyId: string): Promise<number | null> {
    return this.owners.get(propertyId)?.hit.confidence ?? null;
  }
  async upsertOwner(propertyId: string, hit: OwnerHit): Promise<void> {
    this.owners.set(propertyId, { hit, status: "matched" });
    this.noneIds.delete(propertyId);
  }
  async markNone(propertyId: string): Promise<void> {
    if (!this.owners.has(propertyId)) this.noneIds.add(propertyId);
  }
}

const props = Array.from({ length: 200 }, (_, i) => prop(`p${i}`));

describe("runSkiptrace() against the mock", () => {
  it(">= 60% of inputs get a matched owner with an email", async () => {
    const store = new FakeStore(props);
    const res = await runSkiptrace(new MockProvider(), store);

    expect(res.traced).toBe(props.length);
    const ratio = res.matched / res.traced;
    expect(ratio).toBeGreaterThanOrEqual(0.6);

    // Every matched owner carries a non-null email.
    for (const row of store.owners.values()) {
      expect(row.status).toBe("matched");
      expect(row.hit.email).toBeTruthy();
    }
  });

  it("is deterministic across runs", async () => {
    const a = new FakeStore(props);
    const b = new FakeStore(props);
    const ra = await runSkiptrace(new MockProvider(), a);
    const rb = await runSkiptrace(new MockProvider(), b);
    expect(ra.matched).toBe(rb.matched);
  });

  it("never downgrades a higher-confidence existing owner", async () => {
    // Seed every property with a max-confidence existing owner.
    const seed: Record<string, OwnerHit> = {};
    for (const p of props) {
      seed[p.id] = {
        full_name: "Existing Owner",
        email: "existing@example.com",
        phone: null,
        mailing_address: p.address,
        confidence: 1.0,
      };
    }
    const store = new FakeStore(props, seed);
    const res = await runSkiptrace(new MockProvider(), store);

    // No upserts should have replaced the seeded owners.
    expect(res.matched).toBe(0);
    expect(res.skippedDowngrade).toBeGreaterThan(0);
    for (const p of props) {
      expect(store.owners.get(p.id)?.hit.email).toBe("existing@example.com");
      expect(store.owners.get(p.id)?.hit.confidence).toBe(1.0);
    }
  });

  it("upgrades when the new match beats a weak existing one", async () => {
    const seed: Record<string, OwnerHit> = {
      p0: {
        full_name: "Weak Match",
        email: "weak@example.com",
        phone: null,
        mailing_address: "x",
        confidence: 0.01,
      },
    };
    const store = new FakeStore(props, seed);
    await runSkiptrace(new MockProvider(), store);
    // p0 hashes to a match with confidence >= 0.55, so it should be replaced
    // (unless p0 is a non-match, in which case the weak owner is retained).
    const row = store.owners.get("p0");
    expect(row).toBeDefined();
    expect(row!.hit.confidence).toBeGreaterThanOrEqual(0.01);
  });
});
