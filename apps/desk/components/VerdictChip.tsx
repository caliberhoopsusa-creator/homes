import type { Verdict } from "@parcel/types";
import { VERDICT_CLASS, VERDICT_LABEL } from "@/lib/format";

export function VerdictChip({ verdict }: { verdict: Verdict | null }) {
  if (!verdict) {
    return (
      <span className="inline-block rounded px-2 py-0.5 text-xs font-medium border border-slate-300 bg-slate-100 text-slate-600">
        No underwrite
      </span>
    );
  }
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${VERDICT_CLASS[verdict]}`}
    >
      {VERDICT_LABEL[verdict]}
    </span>
  );
}
