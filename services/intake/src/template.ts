// The assignment-ready purchase agreement template.
//
// COMPLIANCE GATE (PRD §6.5, §8.3): this template MUST be reviewed by a Montana
// real-estate attorney before the first LIVE send. The contract it produces is
// generated and QUEUED only — never sent automatically. A human approves it in
// the desk. The notice below is rendered onto every generated PDF until the
// reviewed flag is flipped via env (CONTRACT_TEMPLATE_REVIEWED=true).
import { ambientEnv, type EnvLike } from "./env.js";

export const ATTORNEY_REVIEW_NOTICE =
  "DRAFT - PENDING MONTANA RE ATTORNEY REVIEW. NOT FOR LIVE SEND.";

export interface ContractFields {
  /** Seller / current owner (the party we're buying from). */
  sellerName: string;
  /** Buyer-assignor (us / our entity). */
  buyerName: string;
  propertyAddress: string;
  /** Offer price = the underwrite's your_mao. */
  offerPrice: number;
  earnestMoney?: number;
  closingDays?: number;
  effectiveDate?: string;
}

/** True once the template has been attorney-reviewed (env-gated). */
export function templateReviewed(env: EnvLike = ambientEnv()): boolean {
  return env.CONTRACT_TEMPLATE_REVIEWED === "true";
}

const usd = (n: number) =>
  "$" + Math.round(n).toLocaleString("en-US", { maximumFractionDigits: 0 });

/**
 * Render the assignment-ready agreement as an array of text lines (one PDF line
 * each). We market an OFFER TO BUY and an assignable equitable interest — never
 * the property "for sale" (MT broker line, §8.3).
 */
export function fillAssignmentTemplate(
  f: ContractFields,
  env: EnvLike = ambientEnv(),
): string[] {
  const earnest = f.earnestMoney ?? 1000;
  const closing = f.closingDays ?? 30;
  const effective = f.effectiveDate ?? new Date().toISOString().slice(0, 10);

  const lines = [
    "ASSIGNABLE PURCHASE & SALE AGREEMENT",
    "",
    `Effective Date: ${effective}`,
    "",
    `1. PARTIES. This Agreement is between ${f.sellerName} ("Seller") and`,
    `   ${f.buyerName} ("Buyer"). Buyer's interest under this Agreement is`,
    "   equitable and freely ASSIGNABLE by Buyer to a third party.",
    "",
    `2. PROPERTY. The real property located at:`,
    `   ${f.propertyAddress}`,
    "",
    `3. PURCHASE PRICE. Buyer offers to purchase the Property for`,
    `   ${usd(f.offerPrice)} (the "Purchase Price"), all cash at closing.`,
    "",
    `4. EARNEST MONEY. ${usd(earnest)} to be deposited upon mutual acceptance.`,
    "",
    `5. CLOSING. On or before ${closing} days after the Effective Date.`,
    "",
    "6. ASSIGNMENT. Buyer may assign all rights and obligations under this",
    "   Agreement to an assignee for a fee, without Seller's further consent.",
    "",
    "7. INSPECTION. Buyer's obligation is contingent on inspection within 10",
    "   days of the Effective Date.",
    "",
    "8. THIS IS AN OFFER TO PURCHASE. It is not a listing and is not an offer",
    "   to sell or market the Property. Buyer is a principal, not a broker.",
    "",
    "_______________________________     _______________________________",
    "Seller                               Buyer",
  ];

  if (!templateReviewed(env)) {
    lines.unshift("", `*** ${ATTORNEY_REVIEW_NOTICE} ***`, "");
  }
  return lines;
}
