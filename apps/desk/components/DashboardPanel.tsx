import "server-only";
import type { DealStage } from "@parcel/types";
import { getDealViews } from "@/lib/views";
import { usd } from "@/lib/format";

const MONTHLY_GOAL = 10_000; // CLAUDE.md: net $10k/month (~one $12k assignment)

// Deals whose fee counts toward "money in motion this month": those that have
// cleared the human gate (under contract → assigned → closed).
const CLEARING_STAGES: DealStage[] = ["Under contract", "Assigned", "Closed"];

function isThisMonth(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  );
}

export async function DashboardPanel() {
  const views = await getDealViews();

  const clearingThisMonth = views.filter(
    (v) =>
      CLEARING_STAGES.includes(v.deal.stage) && isThisMonth(v.deal.created_at),
  );

  const monthFee = clearingThisMonth.reduce(
    (sum, v) => sum + (v.underwrite?.fee_potential ?? 0),
    0,
  );

  const totalDeals = views.length;
  const clearVerdicts = views.filter(
    (v) => v.underwrite?.verdict === "clear",
  ).length;
  const pct = Math.min(100, Math.round((monthFee / MONTHLY_GOAL) * 100));

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Metric
          label="Pace to $10k (this month)"
          value={usd(monthFee)}
          sub={`${pct}% of goal`}
        />
        <Metric
          label="Clearing deals (mo.)"
          value={String(clearingThisMonth.length)}
          sub="under contract+"
        />
        <Metric
          label="Total deals"
          value={String(totalDeals)}
          sub="broker-line pacing"
        />
        <Metric
          label="Clear verdicts"
          value={String(clearVerdicts)}
          sub="worth working"
        />
      </div>

      <div className="mt-4">
        <div className="mb-1 flex justify-between text-xs text-slate-500">
          <span>$0</span>
          <span>{usd(MONTHLY_GOAL)} goal</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200">
          <div
            className="h-full bg-green-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="text-2xl font-semibold text-slate-900">{value}</div>
      <div className="text-xs text-slate-500">{sub}</div>
    </div>
  );
}
