import Link from "next/link";
import { DashboardPanel } from "@/components/DashboardPanel";
import { Scoreboards } from "@/components/Scoreboards";
import { NextHint } from "@/components/NextHint";
import { RealtimeBoundary } from "@/components/RealtimeBoundary";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <div className="space-y-4">
      <RealtimeBoundary
        tables={["deals", "contracts", "properties", "messages", "replies"]}
      />
      <div>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ← Back to Home
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
          Your money goal
        </h1>
        <p className="max-w-2xl text-sm text-slate-500">
          The target is about <strong className="text-slate-700">$10k a month</strong> —
          roughly one deal. This tracks how close you are this month and the
          rough numbers behind it.
        </p>
        <div className="mt-3">
          <NextHint>
            Watch the three scoreboards below — whichever lane is lowest is where
            to focus. Hover any underlined word for a plain-English explanation.
          </NextHint>
        </div>
      </div>
      <DashboardPanel />
      <Scoreboards />
    </div>
  );
}
