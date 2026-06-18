import { describe, it, expect } from "vitest";
import { scoreLead } from "../lib/scoring";

describe("scoreLead", () => {
  it("scores a no-signal lead as cold", () => {
    const s = scoreLead({ signals: [] });
    expect(s.score).toBe(0);
    expect(s.tier).toBe("cold");
    expect(s.signalCount).toBe(0);
  });

  it("ranks deadline-driven distress above a lone absentee", () => {
    const absentee = scoreLead({ signals: ["absentee"] });
    const foreclosure = scoreLead({ signals: ["preforeclosure"] });
    expect(foreclosure.score).toBeGreaterThan(absentee.score);
  });

  it("rewards stacked leads — more lists means a higher score", () => {
    const one = scoreLead({ signals: ["tax_delinquent"] });
    const stacked = scoreLead({
      signals: ["tax_delinquent", "vacant", "code_violation"],
    });
    expect(stacked.score).toBeGreaterThan(one.score);
    expect(stacked.signalCount).toBe(3);
    expect(stacked.reasons[0]).toMatch(/3 distress lists/i);
  });

  it("dedupes repeated signals so they can't inflate the score", () => {
    const dup = scoreLead({ signals: ["vacant", "vacant", "vacant"] });
    const single = scoreLead({ signals: ["vacant"] });
    expect(dup.score).toBe(single.score);
    expect(dup.signalCount).toBe(1);
  });

  it("caps motivation so signals alone can't exceed the distress ceiling", () => {
    const everything = scoreLead({
      signals: [
        "preforeclosure",
        "probate",
        "tax_delinquent",
        "divorce",
        "vacant",
        "inherited",
        "eviction",
        "lien",
        "water_shutoff",
        "code_violation",
        "absentee",
      ],
    });
    // 70 distress ceiling, no spread → 70.
    expect(everything.score).toBe(70);
  });

  it("adds spread from the underwritten fee, up to the cap", () => {
    const noFee = scoreLead({ signals: ["vacant"] });
    const withFee = scoreLead({ signals: ["vacant"], feePotential: 10000 });
    expect(withFee.score).toBe(noFee.score + 30);
    expect(withFee.reasons.some((r) => /spread/i.test(r))).toBe(true);
  });

  it("classifies a strong stacked + spread lead as hot", () => {
    const s = scoreLead({
      signals: ["preforeclosure", "vacant"],
      feePotential: 12000,
    });
    expect(s.tier).toBe("hot");
    expect(s.score).toBeGreaterThanOrEqual(60);
  });

  it("never exceeds 100", () => {
    const s = scoreLead({
      signals: ["preforeclosure", "probate", "tax_delinquent", "divorce"],
      feePotential: 50000,
    });
    expect(s.score).toBeLessThanOrEqual(100);
  });
});
