"use client";
import { useState, useTransition } from "react";
import { importBuyersAction } from "@/app/actions";

const SAMPLE = JSON.stringify(
  [
    { buyer_name: "Sapphire Capital LLC", city: "Missoula", state: "MT", price: 285000, beds: 3 },
    { buyer_name: "Sapphire Capital LLC", city: "Missoula", state: "MT", price: 340000, beds: 4 },
    { buyer_name: "Glacier Buy & Hold", city: "Bozeman", state: "MT", price: 410000, beds: 3 },
  ],
  null,
  2,
);

// Build the cash-buyer list from public county cash-closing records (no mortgage
// lien = active cash buyer). Paste a normalized JSON array; we infer one buy-box
// per buyer and add them. Wraps the buyers-import logic for in-app use.
export function ImportBuyers() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
      >
        Import from cash-closings
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs text-slate-500">
        Paste a JSON array of cash-closing records{" "}
        <code className="text-slate-400">
          {`[{ "buyer_name", "city", "state", "price", "beds" }]`}
        </code>{" "}
        — one buy-box is inferred per buyer.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder={SAMPLE}
        className="w-full rounded border border-slate-300 p-2 font-mono text-xs"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          disabled={pending || !text.trim()}
          onClick={() =>
            start(async () => {
              const r = await importBuyersAction(text);
              setResult(r.error ? `Error: ${r.error}` : `Imported ${r.inserted} buyer(s).`);
              if (!r.error) setText("");
            })
          }
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {pending ? "Importing…" : "Import"}
        </button>
        <button
          type="button"
          onClick={() => setText(SAMPLE)}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-white"
        >
          Load sample
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded border border-slate-200 px-3 py-1.5 text-sm text-slate-500 hover:bg-white"
        >
          Cancel
        </button>
        {result && <span className="text-xs text-slate-600">{result}</span>}
      </div>
    </div>
  );
}
