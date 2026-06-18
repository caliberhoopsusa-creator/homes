// Twilio inbound-SMS webhook. Honors STOP (revoke consent + suppress) and HELP
// (info reply) — carrier-required keyword handling. Replies with TwiML. A genuine
// reply (not a keyword) is left for a human; we never auto-text back.
import { smsKeyword } from "@parcel/outreach";
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
  const from = (form?.get("From") as string) ?? "";
  const text = (form?.get("Body") as string) ?? "";

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
