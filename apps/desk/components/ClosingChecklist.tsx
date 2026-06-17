"use client";
import { useTransition } from "react";
import type { ClosingTask } from "@parcel/types";
import {
  groupClosingTasks,
  closingProgress,
  CLOSING_TEMPLATE,
} from "@/lib/closing";
import {
  seedClosingAction,
  toggleClosingTaskAction,
} from "@/app/actions";

// The closing coordinator: Max's 5-phase checklist. Empty until seeded, then
// each task is a one-click toggle. Server actions persist + revalidate.
export function ClosingChecklist({
  dealId,
  tasks,
}: {
  dealId: string;
  tasks: ClosingTask[];
}) {
  const [pending, start] = useTransition();

  if (tasks.length === 0) {
    return (
      <div className="text-sm text-slate-500">
        <p className="mb-2">
          No closing checklist yet — {CLOSING_TEMPLATE.length} phases, contract → close.
        </p>
        <button
          disabled={pending}
          onClick={() => start(() => seedClosingAction(dealId))}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-40"
        >
          {pending ? "Starting…" : "Start closing checklist"}
        </button>
      </div>
    );
  }

  const phases = groupClosingTasks(tasks);
  const progress = closingProgress(tasks);

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-green-500 transition-[width]"
            style={{ width: `${progress.pct}%` }}
          />
        </div>
        <span className="text-xs font-medium text-slate-600">
          {progress.done}/{progress.total} ({progress.pct}%)
        </span>
      </div>

      <div className="space-y-4">
        {phases.map(({ def, tasks: phaseTasks, done, total }) => (
          <div key={def.phase}>
            <div className="mb-1 flex items-baseline justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {def.title}
              </h3>
              <span className="text-xs text-slate-400">
                {done}/{total}
              </span>
            </div>
            <ul className="space-y-1">
              {phaseTasks.map((t) => {
                const isDone = t.status === "done";
                return (
                  <li key={t.id}>
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={isDone}
                        disabled={pending}
                        onChange={(e) =>
                          start(() =>
                            toggleClosingTaskAction(t.id, dealId, e.target.checked),
                          )
                        }
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      <span className={isDone ? "text-slate-400 line-through" : "text-slate-700"}>
                        {t.label}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
