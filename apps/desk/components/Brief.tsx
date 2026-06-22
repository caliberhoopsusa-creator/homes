import "server-only";
import type { DealStage, Underwrite } from "@parcel/types";
import { getDealViews } from "@/lib/views";
import { getProperties, getUnderwrites, getDeals } from "@/lib/data";
import { computeNextAction } from "@/lib/next-action";
import { scoreLead } from "@/lib/scoring";
import { buildBrief } from "@/lib/brief";

const GOAL = 10_000;
const IN_PROGRESS: DealStage[] = ["Under contract", "Assigned"];

const isThisMonth = (iso: string): boolean => {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
};

// The "brief me" banner: a plain-English catch-up + the one thing to do first.
// Reads the same data the home page does and hands it to the pure buildBrief().
export async function Brief() {
  const [views, properties, underwrites, deals] = await Promise.all([
    getDealViews(),
    getProperties(),
    getUnderwrites(),
    getDeals(),
  ]);

  const items = views.map((v) =>
    computeNextAction({
      stage: v.deal.stage,
      verdict: v.underwrite?.verdict ?? null,
      contractStatus: v.contract?.status ?? null,
      assigned: !!v.assignedBuyer,
    }),
  );
  const needsYou = items.filter((a) => a.tone === "do").length;
  const contractsToApprove = views.filter(
    (v) => v.contract?.status === "queued",
  ).length;
  const topStep = [...items].sort((a, b) => a.priority - b.priority)[0]?.step ?? null;

  // Earned = closed deals this month (money in the bank). Projected = deals
  // still in progress (real potential, not earned yet) — kept separate so a
  // number can't read as money you already have.
  const earned = views
    .filter((v) => v.deal.stage === "Closed" && isThisMonth(v.deal.created_at))
    .reduce((sum, v) => sum + (v.underwrite?.fee_potential ?? 0), 0);
  const projected = views
    .filter((v) => IN_PROGRESS.includes(v.deal.stage))
    .reduce((sum, v) => sum + (v.underwrite?.fee_potential ?? 0), 0);

  const dealPropIds = new Set(deals.map((d) => d.property_id));
  const uwByProp = new Map<string, Underwrite>();
  for (const u of underwrites) {
    if (!u.property_id) continue;
    const ex = uwByProp.get(u.property_id);
    if (!ex || u.created_at > ex.created_at) uwByProp.set(u.property_id, u);
  }
  const hotLeads = properties
    .filter((p) => !dealPropIds.has(p.id))
    .reduce((n, p) => {
      const s = scoreLead({
        signals: p.distress_signals ?? [],
        feePotential: uwByProp.get(p.id)?.fee_potential ?? null,
      });
      return n + (s.tier === "hot" ? 1 : 0);
    }, 0);

  const brief = buildBrief({
    hotLeads,
    needsYou,
    contractsToApprove,
    monthFee: earned,
    projected,
    goal: GOAL,
    topStep,
  });

  return (
    <section
      aria-label="Status briefing"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white"
        >
          P
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Your briefing
          </p>
          <p className="mt-0.5 text-base leading-relaxed text-slate-800">
            {brief.summary}
          </p>
          {brief.doFirst && (
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              <span className="font-semibold text-blue-700">Do this first: </span>
              {brief.doFirst}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
