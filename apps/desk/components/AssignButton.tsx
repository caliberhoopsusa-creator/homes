"use client";
import { useTransition } from "react";
import { assignDealAction } from "@/app/actions";

// Assign a deal to a buyer (the disposition winner). Creates a queued contract
// — which still needs the explicit human Approve & send in the Contracts queue.
export function AssignButton({
  dealId,
  buyerId,
  assigned,
  disabled,
}: {
  dealId: string;
  buyerId: string;
  assigned: boolean;
  disabled?: boolean;
}) {
  const [pending, start] = useTransition();

  if (assigned) {
    return (
      <span className="rounded bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
        assigned ✓
      </span>
    );
  }

  return (
    <button
      disabled={pending || disabled}
      onClick={() => start(() => assignDealAction(dealId, buyerId))}
      className="rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-40"
    >
      {pending ? "Assigning…" : "Assign"}
    </button>
  );
}
