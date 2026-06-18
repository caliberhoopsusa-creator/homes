import Link from "next/link";
import type { NextAction, NextTone } from "@/lib/next-action";
import { usd } from "@/lib/format";

// Presentational next-move card. Shows, in plain English: what's going on
// (status), the single next move (step), and how to do it (how) — with one
// clear button. Tone drives the color so beginners can scan urgency at a glance.

const TONE: Record<
  NextTone,
  { wrap: string; chip: string; chipText: string; dot: string }
> = {
  do: {
    wrap: "border-blue-200 bg-blue-50/70",
    chip: "bg-blue-600",
    chipText: "Do this next",
    dot: "bg-blue-600",
  },
  wait: {
    wrap: "border-slate-200 bg-slate-50",
    chip: "bg-slate-400",
    chipText: "Waiting",
    dot: "bg-slate-400",
  },
  skip: {
    wrap: "border-slate-200 bg-white",
    chip: "bg-amber-500",
    chipText: "Skip",
    dot: "bg-amber-500",
  },
  done: {
    wrap: "border-green-200 bg-green-50",
    chip: "bg-green-600",
    chipText: "Done",
    dot: "bg-green-600",
  },
};

export function NextMoveCard({
  action,
  href,
  dealAddress,
  profit,
  hero = false,
}: {
  action: NextAction;
  href?: string | null;
  dealAddress?: string;
  profit?: number | null;
  hero?: boolean;
}) {
  const t = TONE[action.tone];

  return (
    <div
      className={`rounded-2xl border p-4 ${t.wrap} ${hero ? "sm:p-6" : ""}`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white ${t.chip}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
          {t.chipText}
        </span>
        {dealAddress && (
          <span className="text-sm font-medium text-slate-700">{dealAddress}</span>
        )}
        {profit != null && action.tone !== "skip" && (
          <span className="text-xs text-slate-500">
            est. profit{" "}
            <strong className={profit >= 0 ? "text-green-700" : "text-red-700"}>
              {usd(profit)}
            </strong>
          </span>
        )}
      </div>

      <p className={`text-slate-600 ${hero ? "text-base" : "text-sm"}`}>
        {action.statusLine}
      </p>
      <p
        className={`mt-1 font-semibold text-slate-900 ${hero ? "text-xl" : "text-base"}`}
      >
        {action.step}
      </p>
      <p className="mt-1 text-sm text-slate-500">{action.how}</p>

      {action.cta && href && (
        <Link
          href={href}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
        >
          {action.cta}
          <span aria-hidden>→</span>
        </Link>
      )}
    </div>
  );
}
