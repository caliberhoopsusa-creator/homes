import { describe, it, expect } from "vitest";
import { nextDueStep } from "../src/schedule.js";

const NOW = new Date("2026-06-18T12:00:00Z");
const daysAgo = (n: number): string =>
  new Date(NOW.getTime() - n * 86_400_000).toISOString();

describe("nextDueStep", () => {
  it("sends touch 1 to an owner with no history", () => {
    expect(nextDueStep(undefined, NOW)).toBe(1);
    expect(nextDueStep({ lastStep: 0, lastSentAt: null }, NOW)).toBe(1);
  });

  it("holds until the gap to the next touch has elapsed", () => {
    // Step 1 → 2 gap is 3 days. Sent 2 days ago → not due yet.
    expect(nextDueStep({ lastStep: 1, lastSentAt: daysAgo(2) }, NOW)).toBeNull();
  });

  it("advances to the next touch once the gap has elapsed", () => {
    // 3 days since step 1 → step 2 is due.
    expect(nextDueStep({ lastStep: 1, lastSentAt: daysAgo(3) }, NOW)).toBe(2);
  });

  it("respects each step's own gap (step 3 → 4 is 7 days)", () => {
    expect(nextDueStep({ lastStep: 3, lastSentAt: daysAgo(6) }, NOW)).toBeNull();
    expect(nextDueStep({ lastStep: 3, lastSentAt: daysAgo(7) }, NOW)).toBe(4);
  });

  it("stops after the final touch (sequence complete)", () => {
    expect(nextDueStep({ lastStep: 6, lastSentAt: daysAgo(60) }, NOW)).toBeNull();
  });

  it("never double-sends when history is inconsistent (step but no timestamp)", () => {
    expect(nextDueStep({ lastStep: 2, lastSentAt: null }, NOW)).toBeNull();
  });
});
