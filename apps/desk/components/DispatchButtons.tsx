"use client";
import { useState, useTransition } from "react";
import { dispatchDealAction } from "@/app/actions";

// Disposition send: top-N qualifying buyers get a 24-hr exclusive, then blast the
// rest. Records matches.sent_at (real buyer emails wire in when live).
export function DispatchButtons({
  dealId,
  exclusiveCount,
  blastCount,
}: {
  dealId: string;
  exclusiveCount: number;
  blastCount: number;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const send = (tier: "exclusive" | "blast") =>
    start(async () => {
      const n = await dispatchDealAction(dealId, tier);
      setMsg(
        n > 0
          ? `Sent to ${n} buyer${n === 1 ? "" : "s"} (${tier}).`
          : "No buyers in that tier.",
      );
    });

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <button
        disabled={pending || exclusiveCount === 0}
        onClick={() => send("exclusive")}
        className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50"
      >
        Send to exclusive ({exclusiveCount}, 24h)
      </button>
      <button
        disabled={pending || blastCount === 0}
        onClick={() => send("blast")}
        className="rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
      >
        Blast remaining ({blastCount})
      </button>
      {msg && (
        <span className="text-xs text-slate-500">{pending ? "Working…" : msg}</span>
      )}
    </div>
  );
}
