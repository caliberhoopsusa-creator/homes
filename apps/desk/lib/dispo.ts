// Disposition plan (PRD §6.6 / research §7): when a deal is ready, send it to the
// top N qualifying cash buyers with a short EXCLUSIVE window, then blast the rest.
// Pure logic over the already-ranked matches — no I/O — so it stays testable and
// the desk just renders the tiers. The actual sends reuse the outreach engine.
import type { Buyer } from "@parcel/types";
import type { MatchResult } from "./match";

export interface RankedBuyer {
  buyer: Buyer;
  result: MatchResult;
}

export type DispoTier = "exclusive" | "blast" | "no-match";

export interface DispoPlan {
  /** Hours the top tier gets the deal exclusively before the blast. */
  exclusiveHours: number;
  /** How many buyers are in the exclusive tier. */
  topN: number;
  /** Top-N qualifying buyers (the 24-hr exclusive tier), best score first. */
  exclusive: RankedBuyer[];
  /** Remaining qualifying buyers (the blast tier). */
  blast: RankedBuyer[];
  /** Which tier a given buyer falls into. */
  tierOf(buyerId: string): DispoTier;
}

export interface DispoOptions {
  topN?: number;
  exclusiveHours?: number;
}

/**
 * Build the dispo plan from buyers already ranked by `matchScore` (desc).
 * Only QUALIFYING buyers are dispositioned; the top N get the exclusive window.
 */
export function buildDispoPlan(
  ranked: RankedBuyer[],
  opts: DispoOptions = {},
): DispoPlan {
  const topN = opts.topN ?? 5;
  const exclusiveHours = opts.exclusiveHours ?? 24;

  const qualifying = ranked
    .filter((r) => r.result.qualifies)
    .slice()
    .sort((a, b) => b.result.score - a.result.score);

  const exclusive = qualifying.slice(0, topN);
  const blast = qualifying.slice(topN);
  const exclusiveIds = new Set(exclusive.map((r) => r.buyer.id));
  const blastIds = new Set(blast.map((r) => r.buyer.id));

  return {
    exclusiveHours,
    topN,
    exclusive,
    blast,
    tierOf(buyerId: string): DispoTier {
      if (exclusiveIds.has(buyerId)) return "exclusive";
      if (blastIds.has(buyerId)) return "blast";
      return "no-match";
    },
  };
}
