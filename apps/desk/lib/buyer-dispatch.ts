// Buyer-disposition email — the blast that goes to cash buyers when a deal is
// dispatched. PURE builder (no I/O) so it's unit-testable. CAN-SPAM applies to
// commercial email to buyers too: the body carries a physical mailing address
// and a working opt-out. Opt-out here is reply-based ("REMOVE"), honored by the
// suppression list (see dispatchToBuyers' pre-send suppression check).
//
// MT framing (CLAUDE.md #5): an assignable contract / investment opportunity,
// never the seller's home "for sale".
import { usd } from "./format";

export interface BuyerDispoEmailInput {
  buyerName: string | null;
  address: string;
  city: string | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  arv: number;
  repairs: number;
  buyerCeiling: number;
  /** Absolute URL to the deal-package PDF. */
  packageUrl: string;
  /** Physical mailing address (CAN-SPAM). */
  mailingAddress: string;
}

export interface BuiltBuyerEmail {
  subject: string;
  body: string;
}

/** Build a CAN-SPAM-compliant buyer-disposition email. */
export function buildBuyerDispoEmail(d: BuyerDispoEmailInput): BuiltBuyerEmail {
  const where = d.city ? `${d.address}, ${d.city}` : d.address;
  const subject = `Off-market deal: ${where}`;
  const greeting = d.buyerName ? `Hi ${d.buyerName},` : "Hi,";
  const body = [
    greeting,
    "",
    `I have an assignable contract on ${where} that fits your buy box:`,
    `  • ${d.beds ?? "?"} bd / ${d.baths ?? "?"} ba · ${d.sqft ?? "?"} sqft`,
    `  • ARV ${usd(d.arv)} · est. repairs ${usd(d.repairs)}`,
    `  • Your max buy price (ceiling): ${usd(d.buyerCeiling)}`,
    "",
    `Full deal package: ${d.packageUrl}`,
    "",
    "Cash, as-is, close on your timeline. Reply if you want it — first qualified",
    "buyer with proof of funds gets a 24-hour exclusive on the assignment.",
    "",
    "—",
    "You're receiving this because you're on our cash-buyer list. We market our",
    "contract rights to investors; we are not a real estate broker.",
    d.mailingAddress,
    "Don't want deal alerts? Reply REMOVE and we'll take you off the list.",
    "",
  ].join("\n");
  return { subject, body };
}
