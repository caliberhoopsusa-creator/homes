import "server-only";
import type { Board } from "@/lib/scoreboards";
import { computeScoreboards } from "@/lib/scoreboards";
import {
  getBuyers,
  getContracts,
  getDeals,
  getMessages,
  getProperties,
  getReplies,
  getUnderwrites,
} from "@/lib/data";
import { usd } from "@/lib/format";
import { Term } from "@/components/Term";
import type { GlossaryKey } from "@/lib/glossary";

// Accent per board so the three parts of the business read as distinct lanes.
const ACCENT: Record<string, string> = {
  Marketing: "border-t-blue-500",
  Acquisitions: "border-t-amber-500",
  Dispositions: "border-t-green-500",
};

// Stat labels that carry jargon → the term to explain (keeps the visible text).
const LABEL_TERM: Record<string, GlossaryKey> = {
  "Fees earned": "assignment_fee",
  "Under contract": "under_contract",
  "Deals assigned": "dispo",
  "Buyers on list": "buy_box",
};

export async function Scoreboards() {
  const [properties, messages, replies, contracts, deals, buyers, underwrites] =
    await Promise.all([
      getProperties(),
      getMessages(),
      getReplies(),
      getContracts(),
      getDeals(),
      getBuyers(),
      getUnderwrites(),
    ]);

  const boards = computeScoreboards({
    properties,
    messages,
    replies,
    contracts,
    deals,
    buyers,
    underwrites,
  });

  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        The three scoreboards
      </h2>
      <p className="mb-3 max-w-2xl text-xs text-slate-400">
        The activity that drives the business, split into the three jobs:
        find sellers, sign contracts, sell to buyers. Watch these, not just the
        money bar.
      </p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <BoardCard board={boards.marketing} accent={ACCENT.Marketing!} />
        <BoardCard board={boards.acquisitions} accent={ACCENT.Acquisitions!} />
        <BoardCard board={boards.dispositions} accent={ACCENT.Dispositions!} />
      </div>
    </section>
  );
}

function BoardCard({ board, accent }: { board: Board; accent: string }) {
  return (
    <div
      className={`rounded-lg border border-t-4 border-slate-200 bg-white p-4 ${accent}`}
    >
      <h3 className="text-base font-bold text-slate-900">{board.title}</h3>
      <p className="mb-3 text-xs text-slate-500">{board.blurb}</p>
      <dl className="grid grid-cols-3 gap-2">
        {board.stats.map((s) => (
          <div key={s.label}>
            <dd className="text-xl font-semibold tabular-nums text-slate-900">
              {s.money ? usd(s.value) : s.value}
            </dd>
            <dt className="text-[11px] font-medium leading-tight text-slate-600">
              {LABEL_TERM[s.label] ? (
                <Term k={LABEL_TERM[s.label]!}>{s.label}</Term>
              ) : (
                s.label
              )}
            </dt>
            {s.sub && (
              <div className="text-[11px] leading-tight text-slate-400">
                {s.sub}
              </div>
            )}
          </div>
        ))}
      </dl>
    </div>
  );
}
