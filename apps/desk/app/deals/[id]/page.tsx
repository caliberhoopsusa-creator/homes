import Link from "next/link";
import { notFound } from "next/navigation";
import { underwrite } from "@parcel/underwriting";
import {
  getBuyers,
  getDeal,
  getOwnerForProperty,
  getProperty,
  getUnderwriteForProperty,
} from "@/lib/data";
import { matchScore } from "@/lib/match";
import { buildDispoPlan, type DispoTier } from "@/lib/dispo";
import { SpreadBar } from "@/components/SpreadBar";
import { AssignButton } from "@/components/AssignButton";
import { usd } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const deal = await getDeal(id);
  if (!deal) notFound();

  const property = deal.property_id
    ? await getProperty(deal.property_id)
    : null;
  const [owner, uwRow, buyers] = await Promise.all([
    property ? getOwnerForProperty(property.id) : Promise.resolve(null),
    property ? getUnderwriteForProperty(property.id) : Promise.resolve(null),
    getBuyers(),
  ]);

  // Re-run the canonical engine for the spread bar so the desk's math is
  // always the engine's math. ARV/repairs come from the stored underwrite;
  // asking from the property.
  const arv = uwRow?.arv ?? property?.est_value ?? 0;
  const repairs = uwRow?.repairs ?? 0;
  const asking = property?.asking ?? 0;
  const live = underwrite({
    arv,
    repairs,
    asking,
    rulePct: uwRow?.rule_pct,
    feeTarget: uwRow?.fee_target,
  });

  // Rank buyers via the pure matchScore against the live underwrite.
  const ranked = buyers
    .map((buyer) => ({
      buyer,
      result: matchScore(
        {
          property: {
            beds: property?.beds ?? null,
            city: property?.city ?? null,
            state: property?.state ?? null,
          },
          price: live.buyerCeiling,
          repairs: live.repairs,
        },
        buyer,
      ),
    }))
    .sort((a, b) => b.result.score - a.result.score);

  // Disposition: top qualifying buyers get a 24-hr exclusive, then blast the rest.
  const dispo = buildDispoPlan(ranked);

  const assignedBuyerId = deal.assigned_buyer_id;
  const assignedBuyer = assignedBuyerId
    ? buyers.find((b) => b.id === assignedBuyerId) ?? null
    : null;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-sm text-slate-500 hover:underline">
          ← Pipeline
        </Link>
        <h1 className="mt-1 text-xl font-semibold">
          {property?.address ?? "Unknown property"}
        </h1>
        <p className="text-sm text-slate-500">
          {property
            ? `${property.city ?? ""}, ${property.state ?? ""} ${property.zip ?? ""}`
            : "—"}{" "}
          · Stage: {deal.stage}
          {assignedBuyer && (
            <>
              {" "}
              ·{" "}
              <span className="font-medium text-green-700">
                Assigned to {assignedBuyer.name}
              </span>
            </>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* property facts */}
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">
            Property
          </h2>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <Fact label="Beds" value={property?.beds ?? "—"} />
            <Fact label="Baths" value={property?.baths ?? "—"} />
            <Fact label="Sqft" value={property?.sqft ?? "—"} />
            <Fact label="Year" value={property?.year_built ?? "—"} />
            <Fact label="Est. value" value={usd(property?.est_value)} />
            <Fact label="Asking" value={usd(property?.asking)} />
          </dl>
          <div className="mt-3 flex flex-wrap gap-1">
            {(property?.distress_signals ?? []).map((s) => (
              <span
                key={s}
                className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
              >
                {s.replace("_", " ")}
              </span>
            ))}
          </div>
          {owner && (
            <div className="mt-4 border-t border-slate-100 pt-3 text-sm">
              <div className="text-xs uppercase tracking-wide text-slate-400">
                Owner
              </div>
              <div className="font-medium">{owner.full_name ?? "—"}</div>
              <div className="text-slate-500">
                {owner.email ?? "no email"} · {owner.phone ?? "no phone"}
              </div>
              <div className="text-xs text-slate-400">
                skiptrace: {owner.skiptrace_status}
                {owner.skiptrace_confidence != null
                  ? ` (${Math.round(owner.skiptrace_confidence * 100)}%)`
                  : ""}
              </div>
            </div>
          )}
        </section>

        {/* underwriting + spread bar */}
        <section className="rounded-lg border border-slate-200 bg-white p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">
              Underwriting
            </h2>
            {uwRow?.is_estimate && (
              <span className="rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                estimate
              </span>
            )}
          </div>
          <SpreadBar
            arv={arv}
            repairs={repairs}
            asking={asking}
            rulePct={uwRow?.rule_pct}
            feeTarget={uwRow?.fee_target}
          />
          {deal.notes && (
            <p className="mt-4 border-t border-slate-100 pt-3 text-sm text-slate-600">
              {deal.notes}
            </p>
          )}
        </section>
      </div>

      {/* buyer matches */}
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-1 text-sm font-semibold text-slate-700">
          Buyer matches &amp; disposition{" "}
          <span className="text-xs font-normal text-slate-400">
            (ranked by matchScore)
          </span>
        </h2>
        <p className="mb-3 text-xs text-slate-500">
          Dispo plan: send to the top{" "}
          <span className="font-medium text-slate-700">
            {dispo.exclusive.length}
          </span>{" "}
          qualifying buyer{dispo.exclusive.length === 1 ? "" : "s"} with a{" "}
          <span className="font-medium text-slate-700">
            {dispo.exclusiveHours}h exclusive
          </span>{" "}
          window, then blast the remaining{" "}
          <span className="font-medium text-slate-700">{dispo.blast.length}</span>.
          {dispo.exclusive.length === 0 &&
            " No qualifying buyers yet — add buy-boxes or widen criteria."}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="py-1 pr-4">Buyer</th>
                <th className="py-1 pr-4">Type</th>
                <th className="py-1 pr-4">Score</th>
                <th className="py-1 pr-4">Tier</th>
                <th className="py-1 pr-4">Qualifies</th>
                <th className="py-1 pr-4">Why</th>
                <th className="py-1">Action</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map(({ buyer, result }) => (
                <tr key={buyer.id} className="border-t border-slate-100">
                  <td className="py-2 pr-4 font-medium">{buyer.name}</td>
                  <td className="py-2 pr-4 text-slate-500">{buyer.type}</td>
                  <td className="py-2 pr-4">{result.score.toFixed(2)}</td>
                  <td className="py-2 pr-4">
                    <TierBadge tier={dispo.tierOf(buyer.id)} />
                  </td>
                  <td className="py-2 pr-4">
                    {result.qualifies ? (
                      <span className="text-green-700">✓ qualifies</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-xs text-slate-500">
                    {result.reasons.join(", ")}
                  </td>
                  <td className="py-2">
                    <AssignButton
                      dealId={deal.id}
                      buyerId={buyer.id}
                      assigned={assignedBuyerId === buyer.id}
                      disabled={
                        !result.qualifies ||
                        (assignedBuyerId != null && assignedBuyerId !== buyer.id)
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function TierBadge({ tier }: { tier: DispoTier }) {
  if (tier === "exclusive")
    return (
      <span className="rounded bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
        24h exclusive
      </span>
    );
  if (tier === "blast")
    return (
      <span className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
        blast
      </span>
    );
  return <span className="text-xs text-slate-400">—</span>;
}

function Fact({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="font-medium text-slate-800">{value}</dd>
    </div>
  );
}
