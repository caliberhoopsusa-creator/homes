import Link from "next/link";
import { getConnections, type ConnStatus } from "@/lib/connections";

export const dynamic = "force-dynamic";

const DOT: Record<ConnStatus, string> = {
  connected: "bg-green-500",
  partial: "bg-amber-500",
  off: "bg-slate-300",
};
const BADGE: Record<ConnStatus, string> = {
  connected: "bg-green-100 text-green-700",
  partial: "bg-amber-100 text-amber-700",
  off: "bg-slate-100 text-slate-500",
};
const BADGE_TEXT: Record<ConnStatus, string> = {
  connected: "Connected",
  partial: "Needs a step",
  off: "Not set up",
};

export default function SetupPage() {
  const connections = getConnections();
  const done = connections.filter((c) => c.status === "connected").length;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ← Back to Home
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
          Setup &amp; connections
        </h1>
        <p className="max-w-2xl text-sm text-slate-500">
          What's connected and what still needs a key. {done} of{" "}
          {connections.length} ready. Settings live in{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
            apps/desk/.env.local
          </code>{" "}
          — no secrets are shown on this page.
        </p>
      </div>

      <div className="space-y-3">
        {connections.map((c) => (
          <div
            key={c.id}
            className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="flex items-start gap-3">
              <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${DOT[c.status]}`} />
              <div>
                <div className="font-semibold text-slate-900">{c.label}</div>
                <div className="text-sm text-slate-600">{c.detail}</div>
                <div className="mt-1 text-xs text-slate-500">
                  <span className="font-medium text-slate-600">Next: </span>
                  {c.how}
                </div>
              </div>
            </div>
            <span
              className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE[c.status]}`}
            >
              {BADGE_TEXT[c.status]}
            </span>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-sm text-blue-900">
        <p className="font-semibold">A note on texting</p>
        <p className="mt-1 text-blue-800">
          Parcel only texts people who have opted in (with STOP/HELP handling).
          Cold automated texting to owners is a TCPA violation and is not
          supported. Email is the primary, lower-risk channel.
        </p>
      </div>
    </div>
  );
}
