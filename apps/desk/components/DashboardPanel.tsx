import "server-only";
import type { DealStage } from "@parcel/types";
import { getDealViews } from "@/lib/views";
import { usd } from "@/lib/format";
import { Term } from "@/components/Term";

const MONTHLY_GOAL = 10_000; // CLAUDE.md: net $10k/month (~one $10k assignment)
const TARGET_FEE = 10_000; // research-backed planning fee (docs/RESEARCH-wholesaling.md)

// EARNED = money actually in the bank: only deals that have CLOSED.
// IN THE WORKS = projected fees from deals still mid-flight (under contract /
// assigned) — real potential, but NOT yet earned, so it never counts toward the
// goal. Keeping these separate is the honest answer to "why does it say $14k
// when I haven't closed anything?".
const IN_PROGRESS_STAGES: DealStage[] = ["Under contract", "Assigned"];

function isThisMonth(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  );
}

export async function DashboardPanel() {
  const views = await getDealViews();

  const feeOf = (v: (typeof views)[number]) => v.underwrite?.fee_potential ?? 0;

  // Earned this month = closed deals only (money in the bank).
  const closedThisMonth = views.filter(
    (v) => v.deal.stage === "Closed" && isThisMonth(v.deal.created_at),
  );
  const earned = closedThisMonth.reduce((sum, v) => sum + feeOf(v), 0);

  // In the works = projected fees from deals still mid-flight (not earned yet).
  const inProgress = views.filter((v) =>
    IN_PROGRESS_STAGES.includes(v.deal.stage),
  );
  const projected = inProgress.reduce((sum, v) => sum + feeOf(v), 0);

  const clearVerdicts = views.filter(
    (v) => v.underwrite?.verdict === "clear",
  ).length;
  const pct = Math.min(100, Math.round((earned / MONTHLY_GOAL) * 100));
  const dealsToGoal = Math.max(0, Math.ceil((MONTHLY_GOAL - earned) / TARGET_FEE));

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Metric
          label="Earned this month"
          value={usd(earned)}
          sub={earned > 0 ? `${pct}% of goal` : "from closed deals"}
        />
        <Metric
          label="In the works (projected)"
          value={usd(projected)}
          sub={`${inProgress.length} deal${inProgress.length === 1 ? "" : "s"} not closed yet`}
        />
        <Metric
          label="Closed deals (mo.)"
          value={String(closedThisMonth.length)}
          sub="fee earned"
        />
        <Metric
          label={<Term k="verdict">Clear verdicts</Term>}
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

      <div className="mt-5 border-t border-slate-100 pt-3">
        <div className="mb-2 text-xs uppercase tracking-wide text-slate-400">
          Funnel benchmarks (research) · ≈ {dealsToGoal} more{" "}
          <Term k="assignment_fee">assignment</Term>
          {dealsToGoal === 1 ? "" : "s"} to goal
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Bench label="Leads / deal" value="~66" />
          <Bench label="Offers / deal" value="~10–15" />
          <Bench label="Fee / deal" value={usd(TARGET_FEE)} />
          <Bench label="Marketing / deal" value="$4–9k" />
        </div>
      </div>
    </section>
  );
}

function Bench({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-slate-50 px-3 py-2">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-base font-semibold text-slate-800">{value}</div>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
}: {
  label: React.ReactNode;
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
