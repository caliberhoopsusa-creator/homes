import { describe, it, expect } from "vitest";
import {
  estimateRepairs,
  REPAIR_PER_SQFT,
  BIG_TICKET,
} from "../src/repairs.js";

describe("estimateRepairs", () => {
  it("base = sqft × tier rate (medium)", () => {
    const r = estimateRepairs(1500, "medium");
    expect(r.total).toBe(1500 * REPAIR_PER_SQFT.medium); // 37,500
    expect(r.breakdown.base).toBe(37_500);
    expect(r.breakdown.bigTicket).toBe(0);
  });

  it("light vs heavy scale by the per-sqft table", () => {
    expect(estimateRepairs(1000, "light").total).toBe(15_000);
    expect(estimateRepairs(1000, "heavy").total).toBe(40_000);
  });

  it("adds big-ticket systems on top of the base", () => {
    const r = estimateRepairs(1000, "light", { bigTicket: ["roof", "hvac"] });
    expect(r.breakdown.base).toBe(15_000);
    expect(r.breakdown.bigTicket).toBe(BIG_TICKET.roof + BIG_TICKET.hvac); // 14,000
    expect(r.total).toBe(29_000);
    expect(r.breakdown.items.map((i) => i.key)).toEqual(["roof", "hvac"]);
  });

  it("falls back to a default sqft when unknown", () => {
    const r = estimateRepairs(null, "medium");
    expect(r.total).toBe(1400 * REPAIR_PER_SQFT.medium); // 35,000
  });

  it("honors a per-market rate override", () => {
    const r = estimateRepairs(1000, "medium", { perSqft: { medium: 30 } });
    expect(r.total).toBe(30_000);
  });
});
