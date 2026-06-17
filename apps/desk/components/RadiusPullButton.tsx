"use client";
import { useState } from "react";
import { radiusPullRequest, type RadiusPullRequest } from "@parcel/types";

// Triggers a sourcing radius-pull. Builds a zod-validated RadiusPullRequest
// (Missoula, MT center by default) and POSTs it to the /api/pull stub.
// Sourcing runs server-side later; the stub just accepts the request.
const DEFAULT_REQUEST: RadiusPullRequest = radiusPullRequest.parse({
  lat: 46.8721,
  lng: -113.994,
  radiusMiles: 15,
  filters: { minBeds: 2, distress: ["absentee", "tax_delinquent"] },
});

export function RadiusPullButton() {
  const [state, setState] = useState<"idle" | "pulling" | "ok" | "error">(
    "idle",
  );

  async function pull() {
    setState("pulling");
    try {
      const res = await fetch("/api/pull", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(DEFAULT_REQUEST),
      });
      setState(res.ok ? "ok" : "error");
    } catch {
      setState("error");
    }
    setTimeout(() => setState("idle"), 2500);
  }

  const label =
    state === "pulling"
      ? "Finding…"
      : state === "ok"
        ? "Leads queued ✓"
        : state === "error"
          ? "Couldn't find leads"
          : "Find leads";

  return (
    <button
      onClick={pull}
      disabled={state === "pulling"}
      className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 disabled:opacity-60"
      title="Find new distressed properties to work (near Missoula, MT). Parcel skip-traces owners and underwrites the numbers for you."
    >
      {label}
    </button>
  );
}
