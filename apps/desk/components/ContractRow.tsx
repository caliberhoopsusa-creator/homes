"use client";
import { useTransition } from "react";
import type { Buyer, Contract, ContractStatus, Property } from "@parcel/types";
import { advanceContractAction } from "@/app/actions";
import { usd } from "@/lib/format";

// The human gate. queued → approved → sent, one explicit click per step.
// NEVER auto-sends. "sent"/"signed"/"void" are terminal here (no button).
const ACTION_LABEL: Partial<Record<ContractStatus, string>> = {
  queued: "Approve & send",
  approved: "Confirm send",
};

const STATUS_CLASS: Record<ContractStatus, string> = {
  queued: "bg-amber-100 text-amber-800",
  approved: "bg-blue-100 text-blue-800",
  sent: "bg-green-100 text-green-800",
  signed: "bg-green-200 text-green-900",
  void: "bg-slate-200 text-slate-600",
};

export function ContractRow({
  contract,
  property,
  buyer,
}: {
  contract: Contract;
  property: Property | null;
  buyer?: Buyer | null;
}) {
  const [pending, start] = useTransition();
  const action = ACTION_LABEL[contract.status];

  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3">
      <div className="text-sm">
        <div className="font-medium">
          {property?.address ?? "Unknown property"}
          {buyer?.name && (
            <span className="ml-2 text-xs font-normal text-slate-500">
              → {buyer.name}
            </span>
          )}
        </div>
        <div className="text-slate-500">
          Offer {usd(contract.offer_price)} ·{" "}
          <span
            className={`rounded px-1.5 py-0.5 text-xs ${STATUS_CLASS[contract.status]}`}
          >
            {contract.status}
          </span>
        </div>
      </div>
      {action ? (
        <button
          disabled={pending}
          onClick={() =>
            start(() => {
              advanceContractAction(contract.id);
            })
          }
          className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-60"
        >
          {pending ? "Working…" : action}
        </button>
      ) : (
        <span className="text-xs text-slate-400">no action</span>
      )}
    </div>
  );
}
