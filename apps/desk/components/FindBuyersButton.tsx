"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

// One-click buyer discovery: POST /api/buyers/discover → finds multi-property
// owners (investors) in the county cadastral and adds them as buyers.
export function FindBuyersButton() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setState("running");
    setMsg(null);
    try {
      const res = await fetch("/api/buyers/discover", { method: "POST" });
      const body = (await res.json().catch(() => null)) as
        | { ok?: boolean; added?: number; discovered?: number; reason?: string; error?: string }
        | null;
      if (res.ok && body?.ok) {
        setMsg(`Added ${body.added ?? 0} of ${body.discovered ?? 0} found`);
        setState("done");
        router.refresh();
      } else {
        setMsg(body?.reason ?? body?.error ?? "not run");
        setState(res.status === 202 ? "done" : "error");
      }
    } catch {
      setState("error");
    }
    setTimeout(() => {
      setState("idle");
      setMsg(null);
    }, 4000);
  }

  return (
    <button
      onClick={run}
      disabled={state === "running"}
      className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      title="Find multi-property owners (investors) in the county cadastral"
    >
      {state === "running"
        ? "Finding…"
        : state === "done"
          ? (msg ?? "Done ✓")
          : state === "error"
            ? "Failed"
            : "Find buyers from county"}
    </button>
  );
}
