import Link from "next/link";
import { getBuyers, getContracts, getProperties } from "@/lib/data";
import { ContractRow } from "@/components/ContractRow";
import { NextHint } from "@/components/NextHint";
import { RealtimeBoundary } from "@/components/RealtimeBoundary";

export const dynamic = "force-dynamic";

export default async function ContractsPage() {
  const [contracts, properties, buyers] = await Promise.all([
    getContracts(),
    getProperties(),
    getBuyers(),
  ]);
  const byId = new Map(properties.map((p) => [p.id, p]));
  const byBuyer = new Map(buyers.map((b) => [b.id, b]));

  // Queue first: the human gate is the queued items needing approval.
  const queued = contracts.filter((c) => c.status === "queued");
  const rest = contracts.filter((c) => c.status !== "queued");

  return (
    <div className="space-y-6">
      <RealtimeBoundary tables={["contracts"]} />
      <div>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ← Back to Home
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
          Contracts
        </h1>
        <p className="max-w-2xl text-sm text-slate-500">
          When a seller says yes, a draft contract lands here. Nothing is ever
          sent automatically — you review the offer and click{" "}
          <strong className="text-slate-700">Approve &amp; send</strong>.
        </p>
        {queued.length > 0 && (
          <div className="mt-3">
            <NextHint>
              Review the offer price on the contract below, then click{" "}
              <strong>Approve &amp; send</strong> — this is how you get paid.
            </NextHint>
          </div>
        )}
      </div>

      {queued.length > 0 && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-sm text-blue-800">
          <strong>{queued.length}</strong> contract{queued.length === 1 ? "" : "s"}{" "}
          need your approval. Review the offer, then approve to send.
        </div>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Needs your approval ({queued.length})
        </h2>
        {queued.length === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-400">
            Nothing waiting on you. Contracts show up here after an owner replies
            “yes”.
          </p>
        )}
        {queued.map((c) => (
          <ContractRow
            key={c.id}
            contract={c}
            property={c.property_id ? byId.get(c.property_id) ?? null : null}
            buyer={c.buyer_id ? byBuyer.get(c.buyer_id) ?? null : null}
          />
        ))}
      </section>

      {rest.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Past contracts ({rest.length})
          </h2>
          {rest.map((c) => (
            <ContractRow
              key={c.id}
              contract={c}
              property={c.property_id ? byId.get(c.property_id) ?? null : null}
              buyer={c.buyer_id ? byBuyer.get(c.buyer_id) ?? null : null}
            />
          ))}
        </section>
      )}
    </div>
  );
}
