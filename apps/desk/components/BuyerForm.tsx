"use client";
import { useState, useTransition } from "react";
import type { Buyer } from "@parcel/types";
import {
  createBuyerAction,
  deleteBuyerAction,
  updateBuyerAction,
} from "@/app/actions";

const field =
  "w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-slate-500 focus:outline-none";

// One form, two modes: create (no buyer) or edit (buyer provided). Submits to
// the matching server action.
export function BuyerForm({
  buyer,
  onDone,
}: {
  buyer?: Buyer;
  onDone?: () => void;
}) {
  const [pending, start] = useTransition();

  function submit(form: FormData) {
    start(async () => {
      if (buyer) await updateBuyerAction(buyer.id, form);
      else await createBuyerAction(form);
      onDone?.();
    });
  }

  return (
    <form action={submit} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <label className="col-span-2 text-xs text-slate-500">
        Name
        <input name="name" defaultValue={buyer?.name ?? ""} className={field} />
      </label>
      <label className="text-xs text-slate-500">
        Type
        <input name="type" defaultValue={buyer?.type ?? ""} className={field} />
      </label>
      <label className="text-xs text-slate-500">
        Min beds
        <input
          name="min_beds"
          type="number"
          defaultValue={buyer?.min_beds ?? ""}
          className={field}
        />
      </label>
      <label className="text-xs text-slate-500">
        Min price
        <input
          name="min_price"
          type="number"
          defaultValue={buyer?.min_price ?? ""}
          className={field}
        />
      </label>
      <label className="text-xs text-slate-500">
        Max price
        <input
          name="max_price"
          type="number"
          defaultValue={buyer?.max_price ?? ""}
          className={field}
        />
      </label>
      <label className="text-xs text-slate-500">
        Max repairs
        <input
          name="max_repairs"
          type="number"
          defaultValue={buyer?.max_repairs ?? ""}
          className={field}
        />
      </label>
      <label className="col-span-2 text-xs text-slate-500 sm:col-span-1">
        Areas (comma-sep)
        <input
          name="areas"
          defaultValue={(buyer?.areas ?? []).join(", ")}
          className={field}
        />
      </label>
      <label className="col-span-2 text-xs text-slate-500 sm:col-span-4">
        Notes
        <input name="notes" defaultValue={buyer?.notes ?? ""} className={field} />
      </label>

      <div className="col-span-2 flex gap-2 sm:col-span-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
        >
          {buyer ? "Save" : "Add buyer"}
        </button>
        {buyer && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await deleteBuyerAction(buyer.id);
                onDone?.();
              })
            }
            className="rounded border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
          >
            Delete
          </button>
        )}
        {buyer && onDone && (
          <button
            type="button"
            onClick={onDone}
            className="rounded border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

// Row with inline edit toggle.
export function BuyerRow({ buyer }: { buyer: Buyer }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="rounded-lg border border-slate-300 bg-white p-3">
        <BuyerForm buyer={buyer} onDone={() => setEditing(false)} />
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between rounded-lg border border-slate-200 bg-white p-3">
      <div className="text-sm">
        <div className="font-medium">
          {buyer.name}{" "}
          <span className="text-xs font-normal text-slate-400">
            {buyer.type}
          </span>
        </div>
        <div className="text-slate-500">
          ${buyer.min_price ?? 0}–${buyer.max_price ?? "∞"} · {buyer.min_beds ?? 0}+
          beds · ≤${buyer.max_repairs ?? "∞"} repairs
        </div>
        <div className="text-xs text-slate-400">
          {(buyer.areas ?? []).join(", ") || "any area"}
          {buyer.notes ? ` · ${buyer.notes}` : ""}
        </div>
      </div>
      <button
        onClick={() => setEditing(true)}
        className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
      >
        Edit
      </button>
    </div>
  );
}
