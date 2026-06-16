// SendGrid Inbound Parse webhook → the gated intake loop.
//
// Point your SendGrid Inbound Parse host at POST /api/inbound. Each owner reply
// is classified and, on positive intent, a QUEUED contract + a Contacted deal
// are written (PRD §6.5). Nothing is ever sent here — the human approves in the
// Contracts queue. Runs server-side on the Node runtime (service-role key).
import type { NextRequest } from "next/server";
import {
  parseInboundParse,
  handleInboundReply,
  makeClassifier,
  makeStorage,
} from "@parcel/intake";
import { createServiceClient, IntakeDbStore } from "@parcel/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  // Inbound Parse posts multipart/form-data.
  let fields: Record<string, string> = {};
  try {
    const form = await req.formData();
    for (const [key, value] of form.entries()) {
      if (typeof value === "string") fields[key] = value;
    }
  } catch {
    return Response.json(
      { ok: false, error: "expected multipart/form-data" },
      { status: 400 },
    );
  }

  const email = parseInboundParse(fields);
  if (!email.fromEmail) {
    return Response.json({ ok: false, error: "missing sender" }, { status: 400 });
  }

  // The store needs Supabase service-role env. Until that's wired, acknowledge
  // (202) so SendGrid won't retry forever; the loop is a no-op without it.
  let store: IntakeDbStore;
  try {
    store = new IntakeDbStore(createServiceClient());
  } catch {
    return Response.json(
      { ok: false, reason: "intake store not configured" },
      { status: 202 },
    );
  }

  try {
    const result = await handleInboundReply(email, {
      store,
      classifier: makeClassifier(),
      storage: makeStorage(),
    });
    return Response.json({ ok: true, result });
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "intake failed" },
      { status: 500 },
    );
  }
}
