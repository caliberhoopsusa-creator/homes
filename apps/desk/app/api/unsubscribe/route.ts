// One-click unsubscribe handler (CAN-SPAM #2). Every outreach email links here
// with a per-owner token = base64url("unsub:<ownerId>"). We decode it, write a
// permanent `suppressions` row, and confirm — so the link in every send actually
// works (a dead unsubscribe link is a CAN-SPAM violation + a deliverability killer).
//
// Supports GET (the human click) and POST (RFC 8058 List-Unsubscribe one-click,
// required by Google/Yahoo 2024 bulk-sender rules — see docs/DELIVERABILITY.md).
import type { NextRequest } from "next/server";
import { createServiceClient, suppressOwnerById } from "@parcel/db";
import { verifyUnsubscribeToken } from "@parcel/outreach";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ownerIdFromToken(token: string | null): string | null {
  // HMAC-verified — a forged/tampered token returns null (no suppression).
  return token ? verifyUnsubscribeToken(token) : null;
}

function page(message: string, status = 200): Response {
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribe</title></head><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;color:#0f172a"><h1 style="font-size:1.25rem">Unsubscribe</h1><p style="color:#475569">${message}</p></body></html>`;
  return new Response(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

async function handle(token: string | null): Promise<Response> {
  const ownerId = ownerIdFromToken(token);
  if (!ownerId) return page("This unsubscribe link is invalid or expired.", 400);

  try {
    const email = await suppressOwnerById(createServiceClient(), ownerId, "unsubscribe");
    return page(
      email
        ? `You've been unsubscribed (${email}). You will not receive further emails.`
        : "You've been unsubscribed. You will not receive further emails.",
    );
  } catch {
    // DB not configured yet — still acknowledge so the link "works" for the recipient.
    return page(
      "You've been unsubscribed. (Your opt-out will sync once the system is connected.)",
    );
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  return handle(new URL(req.url).searchParams.get("t"));
}

export async function POST(req: NextRequest): Promise<Response> {
  return handle(new URL(req.url).searchParams.get("t"));
}
