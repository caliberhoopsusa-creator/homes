import { describe, it, expect } from "vitest";
import type { Buyer } from "@parcel/types";
import { buildDispoPlan, type RankedBuyer } from "../lib/dispo";

function rb(id: string, score: number, qualifies: boolean): RankedBuyer {
  return {
    buyer: {
      id,
      name: id,
      type: null,
      min_price: null,
      max_price: null,
      min_beds: null,
      areas: null,
      max_repairs: null,
      notes: null,
      email: null,
      phone: null,
      created_at: "",
    } as Buyer,
    result: { score, qualifies, reasons: [] },
  };
}

describe("buildDispoPlan", () => {
  it("puts top-N qualifying buyers in the exclusive tier, the rest in blast", () => {
    const plan = buildDispoPlan(
      [rb("a", 0.9, true), rb("b", 0.8, true), rb("c", 0.7, true), rb("d", 0.3, false)],
      { topN: 2, exclusiveHours: 24 },
    );
    expect(plan.exclusive.map((r) => r.buyer.id)).toEqual(["a", "b"]);
    expect(plan.blast.map((r) => r.buyer.id)).toEqual(["c"]); // d doesn't qualify
    expect(plan.tierOf("a")).toBe("exclusive");
    expect(plan.tierOf("c")).toBe("blast");
    expect(plan.tierOf("d")).toBe("no-match");
    expect(plan.exclusiveHours).toBe(24);
  });

  it("defaults to top 5 / 24h", () => {
    const plan = buildDispoPlan([]);
    expect(plan.topN).toBe(5);
    expect(plan.exclusiveHours).toBe(24);
    expect(plan.exclusive).toEqual([]);
  });
});
