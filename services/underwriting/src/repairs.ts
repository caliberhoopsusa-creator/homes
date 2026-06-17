// Repair estimator — Max Maxwell's "be conservative, estimate high" model.
// PURE: no I/O, no deps. A condition tier sets a base $/sqft; big-ticket systems
// (roof/HVAC/foundation) add fixed line items on top. The breakdown feeds the
// buyer-facing deal package so numbers are itemized, not a black box.

export type ConditionTier = "light" | "medium" | "heavy";

/** Base rehab $/sqft by condition (his lesson-3 ranges, conservative midpoints). */
export const REPAIR_PER_SQFT: Record<ConditionTier, number> = {
  light: 15,
  medium: 25,
  heavy: 40,
};

/** Fixed big-ticket adders (his per-system ranges, conservative midpoints). */
export const BIG_TICKET = {
  roof: 8000,
  hvac: 6000,
  foundation: 12000,
} as const;

export type BigTicketKey = keyof typeof BIG_TICKET;

const FALLBACK_SQFT = 1400;

export interface RepairOptions {
  /** Major systems that need replacement, added on top of the base. */
  bigTicket?: BigTicketKey[];
  /** Override the per-sqft table for a specific market. */
  perSqft?: Partial<Record<ConditionTier, number>>;
}

export interface RepairEstimate {
  total: number;
  breakdown: {
    /** sqft × tier rate. */
    base: number;
    /** Sum of big-ticket adders. */
    bigTicket: number;
    /** Per-system line items that were included. */
    items: { key: BigTicketKey; cost: number }[];
  };
}

/**
 * Estimate rehab cost for a property of `sqft` at a given condition `tier`,
 * plus any big-ticket system replacements. Falls back to a default sqft when
 * unknown so the funnel never divides by zero.
 */
export function estimateRepairs(
  sqft: number | null,
  tier: ConditionTier,
  opts: RepairOptions = {},
): RepairEstimate {
  const area = sqft && sqft > 0 ? sqft : FALLBACK_SQFT;
  const rate = opts.perSqft?.[tier] ?? REPAIR_PER_SQFT[tier];
  const base = Math.round(area * rate);

  const items = (opts.bigTicket ?? []).map((key) => ({ key, cost: BIG_TICKET[key] }));
  const bigTicket = items.reduce((sum, i) => sum + i.cost, 0);

  return { total: base + bigTicket, breakdown: { base, bigTicket, items } };
}
