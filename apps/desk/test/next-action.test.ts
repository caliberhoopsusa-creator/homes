import { describe, it, expect } from "vitest";
import { computeNextAction, nextActionHref } from "../lib/next-action";

describe("computeNextAction", () => {
  it("prioritizes a queued contract (seller said yes) above everything", () => {
    const a = computeNextAction({
      stage: "Under contract",
      verdict: "clear",
      contractStatus: "queued",
      assigned: false,
    });
    expect(a.priority).toBe(1);
    expect(a.tone).toBe("do");
    expect(a.target).toBe("/contracts");
    expect(a.cta).toBe("Review contract");
  });

  it("tells you to find a buyer once the contract is locked and unassigned", () => {
    const a = computeNextAction({
      stage: "Under contract",
      verdict: "clear",
      contractStatus: "approved",
      assigned: false,
    });
    expect(a.tone).toBe("do");
    expect(a.step).toMatch(/buyer/i);
    expect(a.target).toBe("deal");
  });

  it("points to the closing checklist once a buyer is assigned", () => {
    const a = computeNextAction({
      stage: "Assigned",
      verdict: "clear",
      contractStatus: "sent",
      assigned: true,
    });
    expect(a.step).toMatch(/closing/i);
    expect(a.tone).toBe("do");
  });

  it("tells a new lead to make an offer (any verdict — wholesaling is a numbers game)", () => {
    for (const verdict of ["clear", "thin", "pass"] as const) {
      const a = computeNextAction({
        stage: "Lead",
        verdict,
        contractStatus: null,
        assigned: false,
      });
      expect(a.tone).toBe("do");
      expect(a.step).toMatch(/offer/i);
    }
  });

  it("says to wait after an offer is sent with no reply", () => {
    const a = computeNextAction({
      stage: "Contacted",
      verdict: "clear",
      contractStatus: null,
      assigned: false,
    });
    expect(a.tone).toBe("wait");
    expect(a.cta).toBeUndefined();
  });

  it("says to skip a no-spread deal past the lead stage", () => {
    const a = computeNextAction({
      stage: "Under contract",
      verdict: "pass",
      contractStatus: null,
      assigned: false,
    });
    expect(a.tone).toBe("skip");
  });

  it("marks a closed deal done", () => {
    const a = computeNextAction({
      stage: "Closed",
      verdict: "clear",
      contractStatus: "signed",
      assigned: true,
    });
    expect(a.tone).toBe("done");
  });

  it("resolves hrefs from the target", () => {
    const contractAction = computeNextAction({
      stage: "Under contract",
      verdict: "clear",
      contractStatus: "queued",
      assigned: false,
    });
    expect(nextActionHref(contractAction, "d1")).toBe("/contracts");
    const dealAction = computeNextAction({
      stage: "Assigned",
      verdict: "clear",
      contractStatus: "sent",
      assigned: true,
    });
    expect(nextActionHref(dealAction, "d1")).toBe("/deals/d1");
  });
});
