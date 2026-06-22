import { describe, it, expect } from "vitest";
import { buildBrief } from "../lib/brief";

const base = {
  hotLeads: 0,
  needsYou: 0,
  contractsToApprove: 0,
  monthFee: 0,
  goal: 10000,
  topStep: null,
};

describe("buildBrief", () => {
  it("says nothing's waiting when the board is empty", () => {
    const b = buildBrief(base);
    expect(b.summary).toMatch(/nothing is waiting/i);
    expect(b.doFirst).toMatch(/find leads/i);
  });

  it("lists inventory in plain English with correct pluralization", () => {
    const b = buildBrief({ ...base, hotLeads: 1, needsYou: 3 });
    expect(b.summary).toContain("1 hot lead");
    expect(b.summary).toContain("3 deals that need you");
    expect(b.summary).toContain("and"); // joins the list
  });

  it("always makes an approvable contract the thing to do first", () => {
    const b = buildBrief({
      ...base,
      contractsToApprove: 2,
      hotLeads: 9,
      topStep: "Find a buyer for 44 Cooper St.",
    });
    expect(b.summary).toContain("2 contracts to approve");
    expect(b.doFirst).toMatch(/approve the waiting contract/i);
  });

  it("falls back to the top next-step when no contract is pending", () => {
    const b = buildBrief({ ...base, topStep: "Find a buyer for 44 Cooper St." });
    expect(b.doFirst).toBe("Find a buyer for 44 Cooper St.");
  });

  it("reports EARNED money as a percentage of the goal", () => {
    const b = buildBrief({ ...base, monthFee: 4200 });
    expect(b.summary).toMatch(/earned \$4,200/i);
    expect(b.summary).toMatch(/42% of the \$10,000 goal/i);
  });

  it("shows a start-of-month message when nothing earned and nothing in progress", () => {
    expect(buildBrief(base).summary).toMatch(/start of the month/i);
  });

  it("never counts in-progress deals as earned — explains they're not closed", () => {
    const b = buildBrief({ ...base, monthFee: 0, projected: 14000 });
    expect(b.summary).toMatch(/haven't closed a deal yet/i);
    expect(b.summary).toMatch(/\$14,000 is in the works/i);
    expect(b.summary).not.toMatch(/earned \$14,000/i);
  });

  it("shows earned plus a separate in-the-works figure", () => {
    const b = buildBrief({ ...base, monthFee: 5000, projected: 14000 });
    expect(b.summary).toMatch(/earned \$5,000/i);
    expect(b.summary).toMatch(/\$14,000 is in the works/i);
  });
});
