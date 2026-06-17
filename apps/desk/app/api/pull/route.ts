import { NextResponse } from "next/server";
import { radiusPullRequest } from "@parcel/types";
import {
  createProvider as createPropertyProvider,
  runPull,
} from "@parcel/sourcing";
import {
  createProvider as createSkiptraceProvider,
  runSkiptrace,
} from "@parcel/skiptrace";
import { runUnderwriting, MockCompsProvider } from "@parcel/underwriting";
import {
  createServiceClient,
  SourcingDbStore,
  SkiptraceDbStore,
  UnderwriteDbStore,
} from "@parcel/db";

// Radius-pull trigger: validate the RadiusPullRequest, then run the funnel's
// front half against Postgres — sourcing (radius pull → properties) → skip-trace
// (owners) → underwriting (the 70% math → underwrites). Returns a summary the
// desk can show. Providers default to mocks (PROPERTY_PROVIDER), so this runs
// end-to-end with no external keys. Sends are NOT triggered here — outreach is a
// separate, paced, human-initiated action.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = radiusPullRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid request", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  // Without Supabase env we can't persist; acknowledge so the UI stays usable.
  let db;
  try {
    db = createServiceClient();
  } catch {
    return NextResponse.json(
      { accepted: true, ran: false, reason: "database not configured", request: parsed.data },
      { status: 202 },
    );
  }

  try {
    const inserted = await runPull(
      createPropertyProvider(),
      new SourcingDbStore(db),
      parsed.data,
    );
    const traced = await runSkiptrace(
      createSkiptraceProvider(),
      new SkiptraceDbStore(db),
    );
    // Comps-backed ARV (Max's method) via the deterministic mock provider until a
    // real sold-comps source is wired (docs/AUTOMATION-PLAN.md).
    const underwritten = await runUnderwriting(new UnderwriteDbStore(db), {
      compsProvider: new MockCompsProvider(),
    });

    return NextResponse.json({
      accepted: true,
      ran: true,
      sourcing: inserted,
      skiptrace: traced,
      underwriting: underwritten,
      ranAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { accepted: false, error: err instanceof Error ? err.message : "pull failed" },
      { status: 500 },
    );
  }
}
