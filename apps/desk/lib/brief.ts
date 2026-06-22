// The "brief me" generator — a plain-English status paragraph, like an assistant
// catching you up: what you've got, how close you are to the goal, and the one
// thing to do first. PURE (no I/O) so it's testable and reused by the home page.
import { usd } from "./format";

export interface BriefInput {
  /** Not-yet-worked leads the score rates "hot". */
  hotLeads: number;
  /** Deals where you (the human) need to act now. */
  needsYou: number;
  /** Draft contracts waiting for your one-click approval. */
  contractsToApprove: number;
  /** Fee earned/locked toward this month's goal, in dollars. */
  monthFee: number;
  /** The monthly money goal, in dollars. */
  goal: number;
  /** The single most important next step, in plain English (from computeNextAction). */
  topStep?: string | null;
}

export interface Brief {
  /** One-paragraph plain-language status. */
  summary: string;
  /** The single highest-priority thing to do, or null if nothing's pressing. */
  doFirst: string | null;
}

const plural = (n: number, one: string, many: string): string =>
  `${n} ${n === 1 ? one : many}`;

/**
 * Build a friendly status brief. Reads money-first: an approvable contract is
 * the most valuable thing on the board, so it always leads "do first".
 */
export function buildBrief(input: BriefInput): Brief {
  const { hotLeads, needsYou, contractsToApprove, monthFee, goal, topStep } = input;
  const pct = goal > 0 ? Math.min(100, Math.round((monthFee / goal) * 100)) : 0;

  // Inventory sentence — only mention what's actually there.
  const parts: string[] = [];
  if (hotLeads > 0) parts.push(`${plural(hotLeads, "hot lead", "hot leads")}`);
  if (contractsToApprove > 0)
    parts.push(`${plural(contractsToApprove, "contract", "contracts")} to approve`);
  if (needsYou > 0)
    parts.push(`${plural(needsYou, "deal", "deals")} that need you`);

  const inventory =
    parts.length === 0
      ? "Nothing is waiting on you right now."
      : `You have ${joinList(parts)}.`;

  const money =
    monthFee > 0
      ? ` You're ${pct}% to this month's ${usd(goal)} goal (${usd(monthFee)} so far).`
      : ` You're at the start of the month — ${usd(goal)} to go.`;

  // Pick the single most valuable action.
  let doFirst: string | null = null;
  if (contractsToApprove > 0) {
    doFirst =
      "Approve the waiting contract — that's a seller who said yes, and it's how you get paid.";
  } else if (topStep) {
    doFirst = topStep;
  } else if (hotLeads > 0) {
    doFirst = "Start working your hottest lead — email the owner a cash offer.";
  } else {
    doFirst = "Click “Find leads” up top to pull fresh properties to work.";
  }

  return { summary: `${inventory}${money}`, doFirst };
}

/** "a, b and c" — Oxford-free, human. */
function joinList(items: string[]): string {
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}
