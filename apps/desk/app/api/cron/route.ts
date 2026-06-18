// Autopilot trigger. Hit on a schedule (Vercel Cron / any scheduler) to run one
// pass of the funnel. Protected by CRON_SECRET — without it the endpoint refuses
// to run, so automation can never be triggered anonymously. It NEVER sends a
// contract; that remains an explicit human click (CLAUDE.md #3).
import type { NextRequest } from "next/server";
import { runAutopilot } from "@/lib/autopilot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // a full pass can take a while on real providers

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false; // not configured → endpoint stays closed
  const header = req.headers.get("authorization");
  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`.
  return header === `Bearer ${secret}`;
}

async function handle(req: NextRequest): Promise<Response> {
  if (!process.env.CRON_SECRET?.trim()) {
    return Response.json(
      { ok: false, reason: "CRON_SECRET not configured" },
      { status: 503 },
    );
  }
  if (!authorized(req)) {
    return Response.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await runAutopilot();
    return Response.json({ ok: true, result });
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "autopilot failed" },
      { status: 500 },
    );
  }
}

// GET for Vercel Cron (which issues GET); POST for manual/other schedulers.
export const GET = handle;
export const POST = handle;
