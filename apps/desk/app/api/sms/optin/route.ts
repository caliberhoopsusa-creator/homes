// Records an SMS opt-in (the TCPA consent paper trail). Public endpoint backing
// the /sms-optin form. Requires explicit consent=true; stores phone + source.
import { smsOptInInput } from "@parcel/types";
import { recordSmsConsent } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  const parsed = smsOptInInput.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: "Consent is required to opt in." },
      { status: 422 },
    );
  }
  await recordSmsConsent({
    phone: parsed.data.phone,
    source: parsed.data.source ?? "web_optin",
  });
  return Response.json({ ok: true });
}
