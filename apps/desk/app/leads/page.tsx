import Link from "next/link";
import type { Owner, Underwrite } from "@parcel/types";
import {
  getDeals,
  getOwners,
  getProperties,
  getUnderwrites,
} from "@/lib/data";
import { WorkLeadButton } from "@/components/WorkLeadButton";
import { LeadScoreBadge } from "@/components/LeadScoreBadge";
import { scoreLead } from "@/lib/scoring";
import { usd } from "@/lib/format";

export const dynamic = "force-dynamic";

const SHOW = 50;

export default async function LeadsPage() {
  const [properties, deals, owners, underwrites] = await Promise.all([
    getProperties(),
    getDeals(),
    getOwners(),
    getUnderwrites(),
  ]);

  const dealProps = new Set(deals.map((d) => d.property_id));
  const ownerByProp = new Map<string, Owner>();
  for (const o of owners) if (o.property_id) ownerByProp.set(o.property_id, o);
  // Latest underwrite per property.
  const uwByProp = new Map<string, Underwrite>();
  for (const u of underwrites) {
    if (!u.property_id) continue;
    const ex = uwByProp.get(u.property_id);
    if (!ex || u.created_at > ex.created_at) uwByProp.set(u.property_id, u);
  }

  const leads = properties
    .filter((p) => !dealProps.has(p.id))
    .map((p) => {
      const uw = uwByProp.get(p.id) ?? null;
      const score = scoreLead({
        signals: p.distress_signals ?? [],
        feePotential: uw?.fee_potential ?? null,
        mao: uw?.your_mao ?? null,
      });
      return { p, owner: ownerByProp.get(p.id) ?? null, uw, score };
    })
    // Hottest (most motivated) leads first; value breaks ties.
    .sort(
      (a, b) =>
        b.score.score - a.score.score ||
        (b.p.est_value ?? 0) - (a.p.est_value ?? 0),
    );

  const shown = leads.slice(0, SHOW);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ← Back to Home
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
          Leads
        </h1>
        <p className="max-w-2xl text-sm text-slate-500">
          Properties you've sourced but haven't started working yet, ranked by{" "}
          <strong className="text-slate-700">motivation</strong> — leads on more
          distress lists with a bigger spread rise to the top. Start at the top:{" "}
          <strong className="text-slate-700">Work this lead</strong> to add it to
          your pipeline, then email the owner an offer.
        </p>
      </div>

      {leads.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <p className="text-base text-slate-600">No new leads right now.</p>
          <p className="mt-1 text-sm text-slate-500">
            Click <strong>Find leads</strong> in the top bar to pull more
            properties to work.
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-slate-400">
            Showing {shown.length} of {leads.length} · sorted by motivation
            (hottest first)
          </p>
          <div className="space-y-2">
            {shown.map(({ p, owner, uw, score }) => (
              <div
                key={p.id}
                className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">
                      {p.address}
                    </span>
                    <LeadScoreBadge score={score} />
                  </div>
                  <div className="text-sm text-slate-500">
                    {[p.city, p.state].filter(Boolean).join(", ")}
                    {p.zip ? ` ${p.zip}` : ""}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(p.distress_signals ?? []).map((s) => (
                      <span
                        key={s}
                        className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700"
                      >
                        {s.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    {owner?.full_name
                      ? `Owner: ${owner.full_name}${owner.mailing_address ? ` · ${owner.mailing_address}` : ""}`
                      : "Owner not traced yet"}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-4">
                  <div className="text-right">
                    <div className="text-xs text-slate-400">Est. value</div>
                    <div className="font-medium tabular-nums text-slate-700">
                      {usd(p.est_value)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-400">Offer up to</div>
                    <div
                      className="font-semibold tabular-nums text-green-700"
                      title="The most you should pay (your MAO from the 70% math)"
                    >
                      {uw?.your_mao != null ? usd(uw.your_mao) : "—"}
                    </div>
                  </div>
                  <WorkLeadButton propertyId={p.id} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
