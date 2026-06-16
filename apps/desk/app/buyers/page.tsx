import { getBuyers } from "@/lib/data";
import { BuyerForm, BuyerRow } from "@/components/BuyerForm";
import { RealtimeBoundary } from "@/components/RealtimeBoundary";

export const dynamic = "force-dynamic";

export default async function BuyersPage() {
  const buyers = await getBuyers();

  return (
    <div className="space-y-6">
      <RealtimeBoundary tables={["buyers"]} />
      <div>
        <h1 className="text-xl font-semibold">Buyers</h1>
        <p className="text-sm text-slate-500">
          The owned buyer list — the defensible asset. Buy-boxes feed deal
          matching.
        </p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Add buyer</h2>
        <BuyerForm />
      </section>

      <div className="space-y-3">
        {buyers.length === 0 && (
          <p className="text-sm text-slate-400">No buyers yet.</p>
        )}
        {buyers.map((b) => (
          <BuyerRow key={b.id} buyer={b} />
        ))}
      </div>
    </div>
  );
}
