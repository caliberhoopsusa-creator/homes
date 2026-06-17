// Closing coordinator — Max's 5-phase "quarterback" timeline as a checklist
// template. PURE: the template + grouping/progress helpers, no I/O (unit-testable).
// The desk seeds closing_tasks from this template per deal.
import type { ClosingPhase, ClosingTask } from "@parcel/types";

export interface ClosingPhaseDef {
  phase: ClosingPhase;
  title: string;
  /** Default tasks, in display order. */
  tasks: string[];
}

/** The template (his Module: Closing Techniques — five phases, contract→close). */
export const CLOSING_TEMPLATE: readonly ClosingPhaseDef[] = [
  {
    phase: "contract_to_assignment",
    title: "1 · Contract → assignment (day 1–3)",
    tasks: [
      "Order preliminary title work",
      "Schedule property inspection (if needed)",
      "Distribute the deal package to buyers",
      "Begin buyer outreach",
    ],
  },
  {
    phase: "buyer_selection",
    title: "2 · Buyer selection (day 4–7)",
    tasks: [
      "Show the property (individually or grouped)",
      "Collect and evaluate offers",
      "Execute the assignment agreement",
    ],
  },
  {
    phase: "due_diligence",
    title: "3 · Due diligence (day 8–14)",
    tasks: [
      "Provide property access for inspection",
      "Share requested documents",
      "Confirm buyer funding",
    ],
  },
  {
    phase: "closing_prep",
    title: "4 · Closing prep (day 15–21)",
    tasks: [
      "Coordinate with title company / attorney",
      "Confirm all parties' documents submitted",
      "Confirm closing date and location",
    ],
  },
  {
    phase: "closing_day",
    title: "5 · Closing day",
    tasks: [
      "Verify funds received by the closing agent",
      "Review the settlement statement (fee on the HUD)",
      "Confirm recording and disbursement",
    ],
  },
] as const;

/** Flatten the template into seed rows (deal_id + phase + label + sort). */
export function closingSeedRows(
  dealId: string,
): { deal_id: string; phase: ClosingPhase; label: string; sort: number }[] {
  return CLOSING_TEMPLATE.flatMap((p, pi) =>
    p.tasks.map((label, ti) => ({
      deal_id: dealId,
      phase: p.phase,
      label,
      sort: pi * 100 + ti,
    })),
  );
}

export interface ClosingPhaseView {
  def: ClosingPhaseDef;
  tasks: ClosingTask[];
  done: number;
  total: number;
}

/** Group stored tasks under the template phases, in template order. */
export function groupClosingTasks(tasks: readonly ClosingTask[]): ClosingPhaseView[] {
  return CLOSING_TEMPLATE.map((def) => {
    const phaseTasks = tasks
      .filter((t) => t.phase === def.phase)
      .sort((a, b) => a.sort - b.sort);
    return {
      def,
      tasks: phaseTasks,
      done: phaseTasks.filter((t) => t.status === "done").length,
      total: phaseTasks.length,
    };
  });
}

/** Overall completion across all closing tasks (0 when none). */
export function closingProgress(tasks: readonly ClosingTask[]): {
  done: number;
  total: number;
  pct: number;
} {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "done").length;
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}
