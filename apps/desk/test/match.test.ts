import { describe, it, expect } from "vitest";
import type { Buyer } from "@parcel/types";
import { matchScore, computeMatchRows } from "../lib/match";

const buyer = (p: Partial<Buyer> = {}): Buyer => ({
  id: "b",
  name: "B",
  type: "flipper",
  min_price: 100_000,
  max_price: 200_000,
  min_beds: 3,
  areas: ["Billings"],
  max_repairs: 50_000,
  notes: null,
  email: null,
  phone: null,
  created_at: "",
  ...p,
});

const deal = (over: Partial<{ beds: number; city: string; price: number; repairs: number }> = {}) => ({
  property: { beds: over.beds ?? 3, city: over.city ?? "Billings", state: "MT" as string | null },
  price: over.price ?? 150_000,
  repairs: over.repairs ?? 30_000,
});

describe("matchScore", () => {
  it("qualifies a buyer whose buy-box fits", () => {
    const r = matchScore(deal(), buyer());
    expect(r.qualifies).toBe(true);
    expect(r.score).toBeGreaterThan(0);
  });

  it("disqualifies on each hard constraint", () => {
    expect(matchScore(deal({ price: 250_000 }), buyer()).qualifies).toBe(false); // above band
    expect(matchScore(deal({ beds: 2 }), buyer()).qualifies).toBe(false); // too few beds
    expect(matchScore(deal({ city: "Bozeman" }), buyer()).qualifies).toBe(false); // outside area
    expect(matchScore(deal({ repairs: 99_999 }), buyer()).qualifies).toBe(false); // too much rehab
  });

  it("ranks a qualifying buyer above a non-qualifying one", () => {
    const q = matchScore(deal(), buyer()).score;
    const nq = matchScore(deal({ price: 999_999 }), buyer()).score;
    expect(q).toBeGreaterThan(nq);
  });
});

describe("computeMatchRows", () => {
  it("scores every buyer (0–100 int), flags qualifies, and ranks desc", () => {
    const fits = buyer({ id: "fits" });
    const tooFewBeds = buyer({ id: "beds", min_beds: 5 });
    const rows = computeMatchRows(deal(), [tooFewBeds, fits]);

    expect(rows.map((r) => r.buyer_id)).toEqual(["fits", "beds"]); // ranked desc
    expect(rows[0]!.qualifies).toBe(true);
    expect(rows[1]!.qualifies).toBe(false);
    for (const r of rows) {
      expect(Number.isInteger(r.score)).toBe(true);
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
    }
  });
});
