"use client";
import { useState } from "react";

// Runs the owner-outreach campaign (POST /api/outreach): emails the clearing
// leads' owners, honoring suppression + CAN-SPAM. Mock until SendGrid is set.
export function OutreachButton() {
  const [state, setState] = useState<"idle" | "running" | "ok" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setState("running");
    setMsg(null);
    try {
      const res = await fetch("/api/outreach", { method: "POST" });
      const body = (await res.json().catch(() => null)) as
        | { ok?: boolean; result?: { considered: number; sent: number; suppressed: number }; reason?: string }
        | null;
      if (res.ok && body?.ok && body.result) {
        const r = body.result;
        setMsg(`Sent ${r.sent} · considered ${r.considered} · suppressed ${r.suppressed}`);
        setState("ok");
      } else {
        setMsg(body?.reason ?? "not run");
        setState(res.status === 202 ? "ok" : "error");
      }
    } catch {
      setState("error");
    }
    setTimeout(() => {
      setState("idle");
      setMsg(null);
    }, 4000);
  }

  const label =
    state === "running"
      ? "Sending…"
      : state === "ok"
        ? (msg ?? "Sent ✓")
        : state === "error"
          ? "Email failed"
          : "Email owners";

  return (
    <button
      onClick={run}
      disabled={state === "running"}
      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition-colors duration-150 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 disabled:opacity-60"
      title="Email owners of worth-working leads an offer to buy (6-touch sequence, CAN-SPAM safe, never contacts opt-outs)"
    >
      {label}
    </button>
  );
}
