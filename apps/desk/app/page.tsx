import Link from "next/link";
import { getDealViews } from "@/lib/views";
import { computeNextAction, nextActionHref } from "@/lib/next-action";
import { NextMoveCard } from "@/components/NextMoveCard";
import { DashboardPanel } from "@/components/DashboardPanel";
import { RealtimeBoundary } from "@/components/RealtimeBoundary";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const views = await getDealViews();

  const items = views
    .map((v) => {
      const action = computeNextAction({
        stage: v.deal.stage,
        verdict: v.underwrite?.verdict ?? null,
        contractStatus: v.contract?.status ?? null,
        assigned: !!v.assignedBuyer,
      });
      return {
        id: v.deal.id,
        action,
        address: v.property?.address ?? "Unknown property",
        profit: v.underwrite?.fee_potential ?? null,
        href: nextActionHref(action, v.deal.id),
      };
    })
    .sort((a, b) => a.action.priority - b.action.priority);

  const hero = items.find((i) => i.action.tone === "do") ?? items[0];
  const rest = items.filter((i) => i.id !== hero?.id);

  const counts = {
    do: items.filter((i) => i.action.tone === "do").length,
    wait: items.filter((i) => i.action.tone === "wait").length,
    approve: views.filter((v) => v.contract?.status === "queued").length,
    closed: views.filter((v) => v.deal.stage === "Closed").length,
  };

  return (
    <div className="space-y-8">
      <RealtimeBoundary tables={["deals", "contracts"]} />

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Welcome back 👋
        </h1>
        <p className="text-sm text-slate-500">
          Here's what's happening and the one thing to do next.
        </p>
      </div>

      {/* status strip — what's going on, at a glance */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Needs you now" value={counts.do} tone="do" />
        <Stat label="Waiting on others" value={counts.wait} tone="wait" />
        <StatLink
          label="Contracts to approve"
          value={counts.approve}
          href="/contracts"
          tone={counts.approve > 0 ? "do" : "wait"}
        />
        <Stat label="Closed (fee earned)" value={counts.closed} tone="done" />
      </div>

      {/* the single next move */}
      {hero ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Your next move
          </h2>
          <NextMoveCard
            action={hero.action}
            href={hero.href}
            dealAddress={hero.address}
            profit={hero.profit}
            hero
          />
        </section>
      ) : (
        <EmptyState />
      )}

      {/* everything else, prioritized */}
      {rest.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            The rest of your list
          </h2>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {rest.map((i) => (
              <NextMoveCard
                key={i.id}
                action={i.action}
                href={i.href}
                dealAddress={i.address}
                profit={i.profit}
              />
            ))}
          </div>
        </section>
      )}

      {/* money goal */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Your money goal
        </h2>
        <DashboardPanel />
      </section>

      <HowItWorks />

      <p className="text-sm text-slate-500">
        <Link href="/leads" className="font-medium text-blue-600 hover:underline">
          Browse sourced leads →
        </Link>{" "}
        ·{" "}
        <Link href="/pipeline" className="font-medium text-blue-600 hover:underline">
          Open the full pipeline →
        </Link>
      </p>
    </div>
  );
}

const STAT_TONE = {
  do: "border-blue-200 bg-blue-50 text-blue-700",
  wait: "border-slate-200 bg-slate-50 text-slate-600",
  done: "border-green-200 bg-green-50 text-green-700",
} as const;

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: keyof typeof STAT_TONE;
}) {
  return (
    <div className={`rounded-xl border p-3 ${STAT_TONE[tone]}`}>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs font-medium">{label}</div>
    </div>
  );
}

function StatLink({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: number;
  href: string;
  tone: keyof typeof STAT_TONE;
}) {
  return (
    <Link
      href={href}
      className={`rounded-xl border p-3 transition-shadow duration-150 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${STAT_TONE[tone]}`}
    >
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs font-medium underline-offset-2 hover:underline">
        {label} →
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-6">
      <p className="text-base text-slate-600">No deals yet — let's get some leads.</p>
      <p className="mt-1 text-xl font-semibold text-slate-900">
        Pull properties to work.
      </p>
      <p className="mt-1 text-sm text-slate-500">
        Click “Find leads” in the top bar. Parcel sources distressed properties,
        skip-traces the owners, and underwrites the numbers for you.
      </p>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    ["Find leads", "Pull distressed properties; Parcel underwrites the profit."],
    ["Make an offer", "Email owners a compliant cash offer to buy."],
    ["Seller says yes", "A draft contract appears — you approve & send it."],
    ["Find a buyer", "Match a cash buyer and send them the deal."],
    ["Close & get paid", "Work the closing checklist; collect your fee."],
  ];
  return (
    <details className="rounded-2xl border border-slate-200 bg-white p-4">
      <summary className="cursor-pointer text-sm font-semibold text-slate-700">
        New here? How Parcel makes you money (5 steps)
      </summary>
      <ol className="mt-3 space-y-2">
        {steps.map(([title, body], i) => (
          <li key={title} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
              {i + 1}
            </span>
            <span className="text-sm">
              <strong className="text-slate-800">{title}.</strong>{" "}
              <span className="text-slate-500">{body}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-slate-400">
        You earn the “assignment fee” — the gap between your contract price and
        what your buyer pays. Target: about one $10k deal a month.
      </p>
    </details>
  );
}
