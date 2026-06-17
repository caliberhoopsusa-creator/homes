import Link from "next/link";
import { getBuyers } from "@/lib/data";
import { BuyerForm, BuyerRow } from "@/components/BuyerForm";
import { ImportBuyers } from "@/components/ImportBuyers";
import { FindBuyersButton } from "@/components/FindBuyersButton";
import { RealtimeBoundary } from "@/components/RealtimeBoundary";

export const dynamic = "force-dynamic";

export default async function BuyersPage() {
  const buyers = await getBuyers();

  return (
    <div className="space-y-6">
      <RealtimeBoundary tables={["buyers"]} />
      <div>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ← Back to Home
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
          Buyers
        </h1>
        <p className="max-w-2xl text-sm text-slate-500">
          Your cash buyers. The more you have, the faster deals sell — when you
          dispatch a deal, it goes to the buyers whose “buy box” fits.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-800">Add a buyer</h2>
          <div className="flex items-center gap-2">
            <FindBuyersButton />
            <ImportBuyers />
          </div>
        </div>
        <p className="mb-3 text-xs text-slate-500">
          No buyers yet? Use <strong>Find from county</strong> or{" "}
          <strong>Import from cash sales</strong> to build the list automatically
          from public records.
        </p>
        <BuyerForm />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Your buyers ({buyers.length})
        </h2>
        {buyers.length === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-400">
            No buyers yet — add one above, or pull them from public records.
          </p>
        )}
        {buyers.map((b) => (
          <BuyerRow key={b.id} buyer={b} />
        ))}
      </section>
    </div>
  );
}
