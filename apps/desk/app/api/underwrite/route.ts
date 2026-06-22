// Underwrite-only trigger: runs the 70%/comps math on every property that lacks
// an `underwrites` row, independent of the (slow) skip-trace step in /api/pull.
// Lets the operator/autopilot top off offer numbers without re-tracing owners.
// Node runtime / service-role. 202s when the DB isn't configured.
import { runUnderwriting, MockCompsProvider } from "@parcel/underwriting";
import { createServiceClient, UnderwriteDbStore } from "@parcel/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(): Promise<Response> {
  let db;
  try {
    db = createServiceClient();
  } catch {
    return Response.json(
      { ok: false, reason: "database not configured" },
      { status: 202 },
    );
  }
  try {
    const result = await runUnderwriting(new UnderwriteDbStore(db), {
      compsProvider: new MockCompsProvider(),
    });
    return Response.json({ ok: true, result });
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "underwriting failed" },
      { status: 500 },
    );
  }
}
