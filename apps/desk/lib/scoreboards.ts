// The three scoreboards (Wholesaling Bible operating system): Marketing,
// Acquisitions, Dispositions — the activity numbers that actually move the
// business, separated by the part of the funnel they measure. PURE (no I/O) so
// it's testable; the dashboard component feeds it the raw rows.
import type {
  Buyer,
  Contract,
  Deal,
  DealStage,
  Message,
  Property,
  Reply,
  Underwrite,
} from "@parcel/types";

export interface ScoreboardsInput {
  properties: Property[];
  messages: Message[];
  replies: Reply[];
  contracts: Contract[];
  deals: Deal[];
  buyers: Buyer[];
  underwrites: Underwrite[];
  /** Treated as "now" for the month window. Defaults to wall clock. */
  now?: Date;
}

export interface Stat {
  label: string;
  value: number;
  /** Render as currency. */
  money?: boolean;
  /** Small caption under the value. */
  sub?: string;
}

export interface Board {
  title: string;
  blurb: string;
  stats: Stat[];
}

export interface Scoreboards {
  marketing: Board;
  acquisitions: Board;
  dispositions: Board;
}

// Deals that have cleared the human contract gate.
const UNDER_CONTRACT_PLUS: DealStage[] = ["Under contract", "Assigned", "Closed"];
const ASSIGNED_PLUS: DealStage[] = ["Assigned", "Closed"];

function sameMonth(iso: string | null | undefined, now: Date): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

const monthSub = (n: number): string => `${n} this month`;

/** A seller-outreach message that actually went out (has a send timestamp). */
function isSellerSent(m: Message): boolean {
  return m.direction === "outbound" && m.kind !== "buyer_dispo" && m.sent_at != null;
}
function isBuyerSent(m: Message): boolean {
  return m.direction === "outbound" && m.kind === "buyer_dispo" && m.sent_at != null;
}

export function computeScoreboards(input: ScoreboardsInput): Scoreboards {
  const now = input.now ?? new Date();
  const { properties, messages, replies, contracts, deals, buyers, underwrites } =
    input;

  // ── Marketing: filling the top of the funnel ──────────────────────────────
  const sellerSent = messages.filter(isSellerSent);
  const marketing: Board = {
    title: "Marketing",
    blurb: "Filling the funnel — leads in, offers out, conversations started.",
    stats: [
      {
        label: "Leads sourced",
        value: properties.length,
        sub: monthSub(properties.filter((p) => sameMonth(p.created_at, now)).length),
      },
      {
        label: "Owners emailed",
        value: sellerSent.length,
        sub: monthSub(sellerSent.filter((m) => sameMonth(m.sent_at, now)).length),
      },
      {
        label: "Replies",
        value: replies.length,
        sub: monthSub(replies.filter((r) => sameMonth(r.created_at, now)).length),
      },
    ],
  };

  // ── Acquisitions: turning interest into a contract ────────────────────────
  const interested = replies.filter((r) => r.intent === "interested");
  const underContract = deals.filter((d) => UNDER_CONTRACT_PLUS.includes(d.stage));
  const acquisitions: Board = {
    title: "Acquisitions",
    blurb: "Interested sellers → signed contracts (your one human click).",
    stats: [
      {
        label: "Interested sellers",
        value: interested.length,
        sub: monthSub(interested.filter((r) => sameMonth(r.created_at, now)).length),
      },
      {
        label: "Offers drafted",
        value: contracts.length,
        sub: monthSub(contracts.filter((c) => sameMonth(c.created_at, now)).length),
      },
      {
        label: "Under contract",
        value: underContract.length,
        sub: `${deals.filter((d) => d.stage === "Under contract").length} active`,
      },
    ],
  };

  // ── Dispositions: selling the contract to a buyer ─────────────────────────
  const assigned = deals.filter((d) => ASSIGNED_PLUS.includes(d.stage));
  const closed = deals.filter((d) => d.stage === "Closed");
  const closedThisMonth = closed.filter((d) => sameMonth(d.created_at, now));
  const feeByProperty = new Map<string, number>();
  for (const u of underwrites) {
    if (u.property_id) feeByProperty.set(u.property_id, u.fee_potential ?? 0);
  }
  const feesEarned = closedThisMonth.reduce(
    (sum, d) => sum + (d.property_id ? feeByProperty.get(d.property_id) ?? 0 : 0),
    0,
  );
  const buyerSent = messages.filter(isBuyerSent);
  const dispositions: Board = {
    title: "Dispositions",
    blurb: "Selling the contract — buyers contacted, deals assigned & closed.",
    stats: [
      {
        label: "Buyers on list",
        value: buyers.length,
        sub: `${buyerSent.length} dispo emails sent`,
      },
      {
        label: "Deals assigned",
        value: assigned.length,
        sub: monthSub(assigned.filter((d) => sameMonth(d.created_at, now)).length),
      },
      {
        label: "Fees earned",
        value: feesEarned,
        money: true,
        sub: `${closed.length} closed all-time`,
      },
    ],
  };

  return { marketing, acquisitions, dispositions };
}
