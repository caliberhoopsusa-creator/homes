"use client";
import Link from "next/link";
import { useTransition } from "react";
import type {
  Buyer,
  Contract,
  ContractStatus,
  Deal,
  DealStage,
  Property,
  Underwrite,
} from "@parcel/types";
import { VerdictChip } from "./VerdictChip";
import { usd } from "@/lib/format";
import { moveDealAction } from "@/app/actions";

const CONTRACT_CLASS: Record<ContractStatus, string> = {
  queued: "bg-amber-100 text-amber-800",
  approved: "bg-blue-100 text-blue-800",
  sent: "bg-green-100 text-green-800",
  signed: "bg-green-200 text-green-900",
  void: "bg-slate-200 text-slate-600",
};

const STAGES: DealStage[] = [
  "Lead",
  "Contacted",
  "Under contract",
  "Assigned",
  "Closed",
];

export function DealCard({
  deal,
  property,
  underwrite,
  assignedBuyer,
  contract,
}: {
  deal: Deal;
  property: Property | null;
  underwrite: Underwrite | null;
  assignedBuyer?: Buyer | null;
  contract?: Contract | null;
}) {
  const [pending, start] = useTransition();
  const idx = STAGES.indexOf(deal.stage);
  const prev = idx > 0 ? STAGES[idx - 1] : null;
  const next = idx < STAGES.length - 1 ? STAGES[idx + 1] : null;

  const move = (stage: DealStage) =>
    start(() => {
      moveDealAction(deal.id, stage);
    });

  return (
    <div
      className={`rounded-md border border-slate-200 bg-white p-3 shadow-sm ${
        pending ? "opacity-60" : ""
      }`}
    >
      <Link
        href={`/deals/${deal.id}`}
        className="block text-sm font-medium text-slate-900 hover:underline"
      >
        {property?.address ?? "Unknown property"}
      </Link>
      <div className="mt-0.5 text-xs text-slate-500">
        {property ? `${property.city ?? ""}, ${property.state ?? ""}` : "—"}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <VerdictChip verdict={underwrite?.verdict ?? null} />
        <span
          className="text-sm text-slate-800"
          title="Estimated profit (your assignment fee)"
        >
          <span className="text-xs text-slate-400">est. profit </span>
          <span className="font-semibold">{usd(underwrite?.fee_potential)}</span>
        </span>
      </div>

      {(assignedBuyer || contract) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2">
          {assignedBuyer && (
            <span className="truncate text-xs text-slate-600" title={assignedBuyer.name ?? ""}>
              → {assignedBuyer.name}
            </span>
          )}
          {contract && (
            <span
              className={`rounded px-1.5 py-0.5 text-[11px] ${CONTRACT_CLASS[contract.status]}`}
            >
              contract {contract.status}
            </span>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          disabled={!prev || pending}
          onClick={() => prev && move(prev)}
          className="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-30"
          title={prev ? `Move to ${prev}` : "At first stage"}
        >
          ←
        </button>
        <span className="text-[11px] uppercase tracking-wide text-slate-400">
          {deal.stage}
        </span>
        <button
          disabled={!next || pending}
          onClick={() => next && move(next)}
          className="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-30"
          title={next ? `Move to ${next}` : "At last stage"}
        >
          →
        </button>
      </div>
    </div>
  );
}
