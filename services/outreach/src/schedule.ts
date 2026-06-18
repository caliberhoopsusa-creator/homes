// Per-owner cadence scheduler. The campaign runner sends ONE step; this decides
// WHICH step an owner is due for today, based on their send history and the
// SEQUENCE day-offsets (0/3/7/14/21/30). Pure + testable — the autopilot uses it
// so a daily run advances each owner through the sequence instead of re-spamming.
import { SEQUENCE, stepTemplate } from "./sequence.js";

export interface OwnerTouchState {
  /** Highest seller-outreach step already SENT to this owner (0 = none). */
  lastStep: number;
  /** ISO timestamp of that last send, or null if none. */
  lastSentAt: string | null;
}

const MS_PER_DAY = 86_400_000;

/**
 * The step to send this owner now, or null if nothing is due (sequence complete,
 * or the next touch's waiting period hasn't elapsed).
 *
 * - Never contacted → touch 1.
 * - Mid-sequence → next step, but only once the gap between this step's day-offset
 *   and the next one has passed since the last send.
 * - Finished (sent the final touch) → null.
 */
export function nextDueStep(
  state: OwnerTouchState | undefined,
  now: Date,
): number | null {
  const lastStep = state?.lastStep ?? 0;
  if (lastStep <= 0) return 1;
  if (lastStep >= SEQUENCE.length) return null; // whole sequence sent
  if (!state?.lastSentAt) return null; // inconsistent state — wait, don't double-send

  const current = stepTemplate(lastStep);
  const next = stepTemplate(lastStep + 1);
  const gapDays = next.dayOffset - current.dayOffset;
  const daysSince = (now.getTime() - new Date(state.lastSentAt).getTime()) / MS_PER_DAY;
  return daysSince >= gapDays ? lastStep + 1 : null;
}
