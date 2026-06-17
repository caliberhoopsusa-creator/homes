"use client";
import { useState } from "react";
import { radiusPullRequest, type RadiusPullRequest } from "@parcel/types";

// Finds new leads (sourcing radius-pull). POSTs a zod-validated request to
// /api/pull and explains the result in plain English — including *why* it failed
// (e.g. the lead source is out of credits) so a beginner isn't left guessing.
const DEFAULT_REQUEST: RadiusPullRequest = radiusPullRequest.parse({
  lat: 46.8721,
  lng: -113.994,
  radiusMiles: 15,
  filters: { minBeds: 2, distress: ["absentee", "tax_delinquent"] },
});

type State = "idle" | "pulling" | "ok" | "info" | "error";

interface PullBody {
  ran?: boolean;
  reason?: string;
  error?: string;
  sourcing?: { inserted?: number };
}

function friendlyError(raw: string | undefined): string {
  const e = raw ?? "";
  if (/402|payment|credit/i.test(e)) {
    return "Your lead source is out of credits. Add credits at firecrawl.dev, or ask to switch to the free county source.";
  }
  if (/firecrawl/i.test(e)) {
    return "The lead source (Firecrawl) returned an error. Check its API key/credits.";
  }
  return e || "Couldn't find leads — please try again.";
}

export function RadiusPullButton() {
  const [state, setState] = useState<State>("idle");
  const [note, setNote] = useState<string | null>(null);

  async function pull() {
    setState("pulling");
    setNote("Searching public records — this can take up to a minute.");
    try {
      const res = await fetch("/api/pull", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(DEFAULT_REQUEST),
      });
      const body = (await res.json().catch(() => null)) as PullBody | null;

      if (res.ok && body?.ran) {
        const n = body.sourcing?.inserted ?? 0;
        setState("ok");
        setNote(
          n > 0
            ? `Found ${n} new lead${n === 1 ? "" : "s"}. They're on your board now.`
            : "No new leads this time — nothing new in the area.",
        );
      } else if (res.ok) {
        setState("info");
        setNote(
          body?.reason === "database not configured"
            ? "Connect your database first so leads can be saved."
            : body?.reason ?? "Request accepted, but nothing ran.",
        );
      } else {
        setState("error");
        setNote(friendlyError(body?.error));
      }
    } catch {
      setState("error");
      setNote("Couldn't reach the server. Check your connection and try again.");
    }
    setTimeout(() => {
      setState("idle");
      setNote(null);
    }, 9000);
  }

  const label =
    state === "pulling"
      ? "Finding…"
      : state === "ok"
        ? "Leads found ✓"
        : state === "info"
          ? "Needs setup"
          : state === "error"
            ? "Couldn't find leads"
            : "Find leads";

  const noteTone =
    state === "ok"
      ? "border-green-200 bg-green-50 text-green-800"
      : state === "error"
        ? "border-red-200 bg-red-50 text-red-800"
        : "border-slate-200 bg-white text-slate-700";

  return (
    <div className="relative">
      <button
        onClick={pull}
        disabled={state === "pulling"}
        className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 disabled:opacity-60"
        title="Find new distressed properties to work (near Missoula, MT). Parcel skip-traces owners and underwrites the numbers for you."
      >
        {label}
      </button>
      {note && (
        <div
          role="status"
          aria-live="polite"
          className={`absolute right-0 top-full z-30 mt-2 w-72 rounded-lg border p-3 text-xs shadow-lg ${noteTone}`}
        >
          {note}
        </div>
      )}
    </div>
  );
}
