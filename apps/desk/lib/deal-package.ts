// Buyer-facing "deal package" (Max's CMA package) — the document that sells the
// assignment. PURE: builds text lines for the dependency-free PDF renderer
// (@parcel/intake renderContractPdf). No I/O here so it's unit-testable.
//
// MT framing (CLAUDE.md #5): we market an assignable CONTRACT / investment
// opportunity to an investor — never the seller's home "for sale".
import { usd } from "./format";

export interface DealPackageInput {
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  yearBuilt: number | null;
  distress: string[];
  // Engine output (so the package can never drift from underwrite()).
  arv: number;
  repairs: number;
  buyerCeiling: number;
  yourMao: number;
  feeTarget: number;
  feePotential: number;
  asking: number;
  verdict: string;
  /** Comps that backed the ARV (0 ⇒ AVM estimate). */
  compCount: number;
  isEstimate: boolean;
  buyerName?: string | null;
}

const arvBasis = (d: DealPackageInput): string =>
  d.compCount > 0
    ? `${d.compCount} comparable sale${d.compCount === 1 ? "" : "s"}`
    : "AVM estimate";

/** Build the deal-package PDF lines. */
export function buildDealPackageLines(d: DealPackageInput): string[] {
  const loc = [d.city, d.state].filter(Boolean).join(", ") + (d.zip ? ` ${d.zip}` : "");
  const lines: string[] = [
    "PARCEL — INVESTMENT DEAL PACKAGE",
    "Off-market opportunity · assignable purchase contract",
    "",
    "PROPERTY",
    `  Address:   ${d.address}`,
    `  Location:  ${loc || "—"}`,
    `  Beds/Baths: ${d.beds ?? "—"} / ${d.baths ?? "—"}    Sqft: ${d.sqft ?? "—"}    Built: ${d.yearBuilt ?? "—"}`,
  ];
  if (d.distress.length) {
    lines.push(`  Signals:   ${d.distress.map((s) => s.replace(/_/g, " ")).join(", ")}`);
  }
  lines.push(
    "",
    "THE NUMBERS",
    `  After-repair value (ARV): ${usd(d.arv)}   (${arvBasis(d)})`,
    `  Estimated repairs:        ${usd(d.repairs)}`,
    `  Buyer ceiling (max pay):  ${usd(d.buyerCeiling)}`,
    `  Acquisition (our MAO):    ${usd(d.yourMao)}`,
    `  Contract basis / asking:  ${usd(d.asking)}`,
    `  Spread at asking:         ${usd(d.feePotential)}`,
    `  Underwrite verdict:       ${d.verdict}`,
    "",
    "WHAT YOU'RE BUYING",
    "  We hold an assignable contract to purchase this property. You take an",
    "  assignment of that contract and close directly with the seller — cash,",
    "  as-is, on your timeline. Numbers above are based on our underwriting.",
    "",
    "NEXT STEP",
    "  Reply to express interest. First qualified buyer with proof of funds",
    "  gets a 24-hour exclusive on the assignment.",
  );
  if (d.buyerName) lines.push("", `Prepared for: ${d.buyerName}`);
  lines.push(
    "",
    "DRAFT — figures are estimates; verify independently before contracting.",
    "Parcel markets its contract rights to investors and is not a real estate broker; the home is not listed.",
  );
  return lines;
}
