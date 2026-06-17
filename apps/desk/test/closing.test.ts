import { describe, it, expect } from "vitest";
import type { ClosingTask } from "@parcel/types";
import {
  CLOSING_TEMPLATE,
  closingSeedRows,
  groupClosingTasks,
  closingProgress,
} from "../lib/closing";

function task(over: Partial<ClosingTask> & Pick<ClosingTask, "id" | "phase">): ClosingTask {
  return {
    deal_id: "d1",
    label: "x",
    status: "pending",
    sort: 0,
    due_at: null,
    done_at: null,
    created_at: "2026-06-17T00:00:00Z",
    ...over,
  };
}

describe("closingSeedRows", () => {
  it("flattens the 5-phase template into ordered seed rows", () => {
    const rows = closingSeedRows("d1");
    const expected = CLOSING_TEMPLATE.reduce((n, p) => n + p.tasks.length, 0);
    expect(rows).toHaveLength(expected);
    expect(rows.every((r) => r.deal_id === "d1")).toBe(true);
    // sort is strictly increasing in template order
    const sorts = rows.map((r) => r.sort);
    expect([...sorts].sort((a, b) => a - b)).toEqual(sorts);
  });
});

describe("groupClosingTasks", () => {
  it("groups tasks under each template phase in order", () => {
    const tasks = [
      task({ id: "a", phase: "closing_day", sort: 401, label: "fund" }),
      task({ id: "b", phase: "contract_to_assignment", sort: 1, label: "title" }),
    ];
    const groups = groupClosingTasks(tasks);
    expect(groups).toHaveLength(CLOSING_TEMPLATE.length);
    expect(groups[0]!.def.phase).toBe("contract_to_assignment");
    expect(groups[0]!.tasks.map((t) => t.id)).toEqual(["b"]);
    expect(groups[4]!.tasks.map((t) => t.id)).toEqual(["a"]);
  });
});

describe("closingProgress", () => {
  it("returns 0% for no tasks", () => {
    expect(closingProgress([])).toEqual({ done: 0, total: 0, pct: 0 });
  });

  it("computes completion percentage", () => {
    const tasks = [
      task({ id: "a", phase: "due_diligence", status: "done" }),
      task({ id: "b", phase: "due_diligence", status: "pending" }),
      task({ id: "c", phase: "due_diligence", status: "done" }),
      task({ id: "d", phase: "due_diligence", status: "pending" }),
    ];
    expect(closingProgress(tasks)).toEqual({ done: 2, total: 4, pct: 50 });
  });
});
