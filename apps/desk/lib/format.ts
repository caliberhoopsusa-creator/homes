// Shared display helpers.
import type { Verdict } from "@parcel/types";

export const usd = (n: number | null | undefined): string =>
  n == null
    ? "—"
    : n.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      });

// Plain-English verdict labels (shown on deal cards + the spread bar). The
// underlying codes stay clear/thin/pass; these are just what a beginner reads.
export const VERDICT_LABEL: Record<Verdict, string> = {
  clear: "Worth working",
  thin: "Marginal",
  pass: "Skip",
};

// Tailwind classes per verdict for chips.
export const VERDICT_CLASS: Record<Verdict, string> = {
  clear: "bg-green-100 text-green-800 border border-green-300",
  thin: "bg-amber-100 text-amber-800 border border-amber-300",
  pass: "bg-red-100 text-red-700 border border-red-300",
};
