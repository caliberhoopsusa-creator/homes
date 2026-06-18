import { describe, it, expect } from "vitest";
import {
  underwrite,
  DEFAULT_RULE_PCT,
  DEFAULT_FEE_TARGET,
} from "../src/underwrite.js";

describe("underwrite() — the 70% math", () => {
  it("computes buyerCeiling = arv*rulePct - repairs", () => {
    const r = underwrite({ arv: 300_000, repairs: 40_000, asking: 150_000 });
    // 300k * 0.70 - 40k = 170k
    expect(r.buyerCeiling).toBe(170_000);
  });

  it("computes yourMao = buyerCeiling - feeTarget", () => {
    const r = underwrite({ arv: 300_000, repairs: 40_000, asking: 150_000 });
    // 170k - 10k = 160k
    expect(r.yourMao).toBe(160_000);
  });

  it("computes feePotential = buyerCeiling - asking", () => {
    const r = underwrite({ arv: 300_000, repairs: 40_000, asking: 150_000 });
    // 170k - 150k = 20k
    expect(r.feePotential).toBe(20_000);
  });

  it("defaults rulePct to 0.70 and feeTarget to 10000", () => {
    const r = underwrite({ arv: 100_000, repairs: 0, asking: 0 });
    expect(r.rulePct).toBe(DEFAULT_RULE_PCT);
    expect(r.feeTarget).toBe(DEFAULT_FEE_TARGET);
  });

  describe("verdict thresholds", () => {
    it("clear when feePotential >= feeTarget (exact boundary)", () => {
      // buyerCeiling 170k, asking 160k -> feePotential 10k == feeTarget(10k)
      const r = underwrite({ arv: 300_000, repairs: 40_000, asking: 160_000 });
      expect(r.feePotential).toBe(10_000);
      expect(r.verdict).toBe("clear");
    });

    it("clear above the target", () => {
      const r = underwrite({ arv: 300_000, repairs: 40_000, asking: 100_000 });
      expect(r.verdict).toBe("clear");
    });

    it("thin when 0 < feePotential < feeTarget", () => {
      // feePotential = 1 (just above zero)
      const r = underwrite({ arv: 300_000, repairs: 40_000, asking: 169_999 });
      expect(r.feePotential).toBe(1);
      expect(r.verdict).toBe("thin");
    });

    it("pass when feePotential == 0 (boundary is exclusive)", () => {
      const r = underwrite({ arv: 300_000, repairs: 40_000, asking: 170_000 });
      expect(r.feePotential).toBe(0);
      expect(r.verdict).toBe("pass");
    });

    it("pass when feePotential is negative", () => {
      const r = underwrite({ arv: 300_000, repairs: 40_000, asking: 200_000 });
      expect(r.verdict).toBe("pass");
    });
  });

  it("honors a custom rulePct and feeTarget", () => {
    const r = underwrite({
      arv: 400_000,
      repairs: 50_000,
      asking: 200_000,
      rulePct: 0.75,
      feeTarget: 20_000,
    });
    // ceiling = 400k*0.75 - 50k = 250k; mao = 230k; fee = 50k -> clear
    expect(r.buyerCeiling).toBe(250_000);
    expect(r.yourMao).toBe(230_000);
    expect(r.feePotential).toBe(50_000);
    expect(r.verdict).toBe("clear");
  });

  it("handles repairs that exceed the ceiling (negative numbers)", () => {
    const r = underwrite({ arv: 100_000, repairs: 90_000, asking: 10_000 });
    // ceiling = 70k - 90k = -20k; fee = -30k -> pass
    expect(r.buyerCeiling).toBe(-20_000);
    expect(r.verdict).toBe("pass");
  });

  it("defaults to 70% mode when no itemized inputs are given", () => {
    const r = underwrite({ arv: 300_000, repairs: 40_000, asking: 150_000 });
    expect(r.mode).toBe("rule70");
  });
});

describe("underwrite() — itemized MAO (Max's full formula)", () => {
  it("switches to itemized mode when buyerProfitPct is provided", () => {
    const r = underwrite({
      arv: 200_000,
      repairs: 40_000,
      asking: 100_000,
      holdingCosts: 3_000,
      closingCosts: 5_000,
      buyerProfitPct: 0.15,
    });
    expect(r.mode).toBe("itemized");
  });

  it("computes buyerCeiling = arv - repairs - holding - closing - arv*profitPct", () => {
    const r = underwrite({
      arv: 200_000,
      repairs: 40_000,
      asking: 100_000,
      holdingCosts: 3_000,
      closingCosts: 5_000,
      buyerProfitPct: 0.15,
    });
    // 200k - 40k - 3k - 5k - 30k = 122k
    expect(r.buyerCeiling).toBe(122_000);
    // mao = 122k - 10k(default fee) = 112k  (matches the masterclass worked example)
    expect(r.yourMao).toBe(112_000);
    // fee = 122k - 100k = 22k -> clear
    expect(r.feePotential).toBe(22_000);
    expect(r.verdict).toBe("clear");
  });

  it("treats missing holding/closing as 0 in itemized mode", () => {
    const r = underwrite({
      arv: 200_000,
      repairs: 40_000,
      asking: 100_000,
      buyerProfitPct: 0.15,
    });
    // 200k - 40k - 0 - 0 - 30k = 130k
    expect(r.buyerCeiling).toBe(130_000);
  });

  it("buyerProfitPct = 0 still triggers itemized mode (presence, not truthiness)", () => {
    const r = underwrite({
      arv: 200_000,
      repairs: 40_000,
      asking: 100_000,
      buyerProfitPct: 0,
    });
    expect(r.mode).toBe("itemized");
    // 200k - 40k - 0 = 160k
    expect(r.buyerCeiling).toBe(160_000);
  });
});
