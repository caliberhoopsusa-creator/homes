import { getBuyers, getContracts, getProperties } from "@/lib/data";
import { ContractRow } from "@/components/ContractRow";
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
        <h1 className="text-xl font-semibold">Contracts</h1>
        <p className="max-w-2xl text-sm text-slate-500">
          The human gate. A contract is only ever sent by an explicit click —
          never auto-sent. Approve queued contracts below.
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">
          Queued ({queued.length})
        </h2>
        {queued.length === 0 && (
          <p className="text-sm text-slate-400">Nothing waiting on you.</p>
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
          <h2 className="text-sm font-semibold text-slate-700">
            History ({rest.length})
          </h2>
          {rest.map((c) => (
            <ContractRow
              key={c.id}
              contract={c}
              property={c.property_id ? byId.get(c.property_id) ?? null : null}
            />
          ))}
        </section>
      )}
    </div>
  );
}
