// Twilio inbound-SMS webhook. Honors STOP (revoke consent + suppress) and HELP
// (info reply) — carrier-required keyword handling. Replies with TwiML. A genuine
// reply (not a keyword) is left for a human; we never auto-text back.
import { smsKeyword, validateTwilioSignature } from "@parcel/outreach";
import { revokeSmsConsent } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function twiml(message?: string): Response {
  const body = message
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message}</Message></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
  return new Response(body, { headers: { "content-type": "text/xml" } });
}

export async function POST(req: Request): Promise<Response> {
  const form = await req.formData().catch(() => null);
  if (!form) return twiml();

  const params: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") params[k] = v;

  // Verify the request really came from Twilio (HMAC over URL + params). Enforced
  // once TWILIO_AUTH_TOKEN is set; skipped in dev/mock so the loop runs keyless.
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (authToken) {
    const ok = validateTwilioSignature({
      authToken,
      url: process.env.TWILIO_WEBHOOK_URL ?? req.url,
      params,
      signature: req.headers.get("x-twilio-signature"),
    });
    if (!ok) return new Response("invalid signature", { status: 403 });
  }

  const from = params.From ?? "";
  const text = params.Body ?? "";

  const keyword = smsKeyword(text);
  if (keyword === "stop" && from) {
    await revokeSmsConsent(from, "STOP");
    return twiml("You're unsubscribed and won't receive more texts. Reply START to opt back in.");
  }
  if (keyword === "help") {
    return twiml("Parcel home offers. Reply STOP to unsubscribe. Msg & data rates may apply.");
  }
  // Real reply — recorded by the carrier; a human follows up. No auto-reply.
  return twiml();
}
