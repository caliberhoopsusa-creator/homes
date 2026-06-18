// The coaching brain: given a deal's state, say in plain English what's going on,
// what the single next move is, and how to do it. PURE (no I/O) so it's testable
// and reused by both the home "next moves" queue and the per-deal banner.
import type { ContractStatus, DealStage, Verdict } from "@parcel/types";

export type NextTone = "do" | "wait" | "skip" | "done";

export interface NextActionInput {
  stage: DealStage;
  verdict: Verdict | null;
  /** Latest contract status for the deal's property, or null if none yet. */
  contractStatus: ContractStatus | null;
  /** Whether the deal has been assigned to a buyer. */
  assigned: boolean;
  /** Whether the owner has an email we can actually send to. */
  ownerHasEmail?: boolean;
}

export interface NextAction {
  /** Lower = more urgent. Sort ascending to get the top move. */
  priority: number;
  tone: NextTone;
  /** What's going on, in plain English. */
  statusLine: string;
  /** The single next move. */
  step: string;
  /** Exactly how to do it. */
  how: string;
  /** Button label (omitted when there's nothing to click — e.g. waiting). */
  cta?: string;
  /** Where the button goes: "deal" (this deal's page) or "/contracts". */
  target?: "deal" | "/contracts";
}

/**
 * Decide the next move for one deal. Checks run in money-first order: an
 * interested seller (queued contract) is the most valuable thing on the board.
 */
export function computeNextAction(input: NextActionInput): NextAction {
  const { stage, verdict, contractStatus, assigned } = input;

  // 1. A seller said yes → a contract is waiting for human approval. The money moment.
  if (contractStatus === "queued") {
    return {
      priority: 1,
      tone: "do",
      statusLine: "A seller is interested — a draft contract is waiting.",
      step: "Review and approve the contract.",
      how: "Open Contracts, check the offer price, then click “Approve & send”.",
      cta: "Review contract",
      target: "/contracts",
    };
  }

  // 2. Contract locked but no buyer yet → find the buyer who pays you the spread.
  if ((contractStatus === "approved" || contractStatus === "sent") && !assigned) {
    return {
      priority: 2,
      tone: "do",
      statusLine: "Contract is locked in. Now you need a buyer.",
      step: "Match a cash buyer and send them the deal.",
      how: "Open the deal, pick a buyer marked “qualifies”, click Assign, then “Send to exclusive”.",
      cta: "Find a buyer",
      target: "deal",
    };
  }

  // 3. Buyer assigned → drive it to the closing table.
  if (assigned && stage !== "Closed") {
    return {
      priority: 3,
      tone: "do",
      statusLine: "You have a buyer. Time to get it closed.",
      step: "Work the closing checklist.",
      how: "Open the deal → Closing coordinator → tick off each step as you go.",
      cta: "Open closing steps",
      target: "deal",
    };
  }

  // 4. A lead with no offer out yet → make an offer. Wholesaling is a numbers
  //    game (Max: "make offers"); even a full-value lead is worth a low offer,
  //    and the deal page shows the most you should pay.
  if (stage === "Lead" && !contractStatus) {
    return {
      priority: 4,
      tone: "do",
      statusLine: "New lead — you haven't made an offer yet.",
      step: "Email the owner an offer to buy.",
      how: "Click “Email owners” in the top bar. Offer up to the “Most you should pay” figure on the deal.",
      cta: "How to make an offer",
      target: "deal",
    };
  }

  // 5. Offer sent, waiting on the owner → nothing to do.
  if (stage === "Contacted" && !contractStatus) {
    return {
      priority: 6,
      tone: "wait",
      statusLine: "Offer sent — waiting for the owner to reply.",
      step: "Nothing to do right now.",
      how: "Replies come in on their own. If they say yes, a contract appears here automatically.",
    };
  }

  // 6. No spread → not worth your time.
  if (verdict === "pass") {
    return {
      priority: 8,
      tone: "skip",
      statusLine: "Not enough profit in this one.",
      step: "Safe to skip — put your energy elsewhere.",
      how: "Leave it. Focus on deals marked “worth working”.",
    };
  }

  // 7. Closed → done.
  if (stage === "Closed" || contractStatus === "signed") {
    return {
      priority: 9,
      tone: "done",
      statusLine: "Closed — assignment fee earned.",
      step: "All done. Nice work.",
      how: "Nothing left to do on this deal.",
    };
  }

  // Fallback: in progress.
  return {
    priority: 7,
    tone: "wait",
    statusLine: "In progress.",
    step: "Keep an eye on this one.",
    how: "Open the deal to see the details.",
  };
}

/** Resolve a NextAction.target to an href for the given deal. */
export function nextActionHref(action: NextAction, dealId: string): string | null {
  if (action.target === "/contracts") return "/contracts";
  if (action.target === "deal") return `/deals/${dealId}`;
  return null;
}
