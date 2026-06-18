// Connection status for the Setup page. Reads only the PRESENCE of env vars
// (never their values) so a beginner can see what's live vs. what still needs a
// key. server-only — env stays on the server.
import "server-only";

export type ConnStatus = "connected" | "partial" | "off";

export interface Connection {
  id: string;
  label: string;
  status: ConnStatus;
  /** Plain-English current state. */
  detail: string;
  /** What to do to turn it on / finish it. */
  how: string;
}

const has = (k: string): boolean => !!process.env[k]?.trim();

export function getConnections(): Connection[] {
  const env = process.env;

  // 1. Database
  const dbLive =
    has("SUPABASE_SERVICE_ROLE_KEY") &&
    (has("SUPABASE_URL") || has("NEXT_PUBLIC_SUPABASE_URL"));

  // 2. Lead source (sourcing)
  const propProvider = (env.PROPERTY_PROVIDER ?? "mock").trim();
  const leadConnected =
    propProvider === "county" ||
    (propProvider === "firecrawl" && has("FIRECRAWL_API_KEY")) ||
    (propProvider === "batchdata" && has("BATCHDATA_API_KEY"));

  // 3. Skip-trace (seller contact accuracy)
  const skipProvider = (env.SKIPTRACE_PROVIDER ?? propProvider).trim();
  const skipReal =
    (skipProvider === "batchdata" && has("BATCHDATA_API_KEY")) ||
    (skipProvider === "firecrawl" && has("FIRECRAWL_API_KEY"));

  // 4. Email (SendGrid)
  const emailProvider = (env.EMAIL_PROVIDER ?? "mock").trim();
  const emailLive = emailProvider === "sendgrid" && has("SENDGRID_API_KEY");
  const emailDomain = has("SENDGRID_FROM_DOMAIN") || has("SENDGRID_FROM_EMAIL");

  // 5. SMS (consent-only)
  const smsProvider = (env.SMS_PROVIDER ?? "off").trim();
  const smsLive = smsProvider === "twilio" && has("TWILIO_AUTH_TOKEN");

  // 6. Contract template (the Montana attorney gate)
  const templateReviewed = env.CONTRACT_TEMPLATE_REVIEWED === "true";

  return [
    {
      id: "database",
      label: "Database",
      status: dbLive ? "connected" : "off",
      detail: dbLive ? "Connected to your live Supabase project." : "Running on demo data.",
      how: dbLive
        ? "Done — records are saved."
        : "Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in apps/desk/.env.local.",
    },
    {
      id: "leads",
      label: "Lead source",
      status: leadConnected ? "connected" : "off",
      detail: `Provider: ${propProvider}${leadConnected ? "" : " (needs a key)"}.`,
      how:
        propProvider === "county"
          ? "Done — free Montana county records. Find leads in the top bar."
          : "Set PROPERTY_PROVIDER=county (free) or add the vendor's API key.",
    },
    {
      id: "skiptrace",
      label: "Seller contacts (skip-trace)",
      status: skipReal ? "connected" : "partial",
      detail: skipReal
        ? `Real seller contacts via ${skipProvider}.`
        : "Using placeholder owner emails (mock skip-trace).",
      how: skipReal
        ? "Done — owner phone/email are real."
        : "Add a paid skip-trace key, then set SKIPTRACE_PROVIDER=batchdata.",
    },
    {
      id: "email",
      label: "Email sending (SendGrid)",
      status: emailLive ? (emailDomain ? "connected" : "partial") : "off",
      detail: emailLive
        ? emailDomain
          ? "SendGrid connected with a sending domain."
          : "SendGrid key set, but no authenticated sending domain."
        : "Emails are simulated (mock) — nothing is actually sent.",
      how: emailLive
        ? emailDomain
          ? "Done — owner/buyer emails send for real."
          : "Authenticate your domain (SPF/DKIM/DMARC) — see docs/DELIVERABILITY.md."
        : "Create a SendGrid account, set EMAIL_PROVIDER=sendgrid + SENDGRID_API_KEY + domain.",
    },
    {
      id: "sms",
      label: "Text messages (consent-only)",
      status: smsLive ? "connected" : "off",
      detail: smsLive
        ? "Twilio connected. Texts go ONLY to opted-in contacts."
        : "Off. SMS is consent-only by design (TCPA).",
      how: smsLive
        ? "Done — texting only people who opted in, with STOP handling."
        : "Add Twilio + a registered number, set SMS_PROVIDER=twilio. Only opted-in contacts are texted.",
    },
    {
      id: "contract",
      label: "Contract template (legal)",
      status: templateReviewed ? "connected" : "partial",
      detail: templateReviewed
        ? "Reviewed — contracts can be sent for real."
        : "DRAFT — Montana attorney review pending. Contracts are watermarked.",
      how: templateReviewed
        ? "Done."
        : "Have a Montana RE attorney review the assignment template, then set CONTRACT_TEMPLATE_REVIEWED=true.",
    },
  ];
}
