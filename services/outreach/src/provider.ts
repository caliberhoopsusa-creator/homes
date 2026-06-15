// EmailProvider (PRD §6.4). Provider integrations sit behind a named interface so
// they are swappable and mockable (architecture rule §7.4). Default is the in-memory
// MockProvider; SendGridProvider is the real shape (v3 mail send) and throws if the
// key is missing. SendGridProvider does NOT need to work live.
import type { EnvLike, FetchLike } from "./env.js";
import { ambientEnv } from "./env.js";

export interface OutboundEmail {
  to: string;
  /** From address ("offer to buy" sender — truthful header). */
  from: string;
  fromName: string;
  replyTo: string;
  subject: string;
  /** Body INCLUDING the CAN-SPAM footer (built upstream). */
  body: string;
}

export interface SendResult {
  providerId: string;
  status: "sent";
}

export interface EmailProvider {
  send(msg: OutboundEmail): Promise<SendResult>;
}

/** Default provider. Records every send in memory for inspection/tests. */
export class MockProvider implements EmailProvider {
  readonly sent: OutboundEmail[] = [];
  private seq = 0;

  async send(msg: OutboundEmail): Promise<SendResult> {
    this.sent.push(msg);
    this.seq += 1;
    return { providerId: `mock-${this.seq}`, status: "sent" };
  }
}

export interface SendGridProviderOptions {
  apiKey?: string;
  fromEmail?: string;
  fromDomain?: string;
  replyTo?: string;
  /** Injectable for tests; defaults to global fetch. */
  fetchImpl?: FetchLike;
}

/**
 * Real-shape SendGrid v3 mail send (https://api.sendgrid.com/v3/mail/send).
 * Faithful typed mapping to the v3 payload. Throws if SENDGRID_API_KEY is missing.
 * Not exercised live in tests.
 */
export class SendGridProvider implements EmailProvider {
  private readonly apiKey: string;
  private readonly fromEmail: string;
  private readonly replyTo: string;
  private readonly fetchImpl: FetchLike;

  constructor(opts: SendGridProviderOptions = {}) {
    const env = ambientEnv();
    const apiKey = opts.apiKey ?? env.SENDGRID_API_KEY;
    if (!apiKey) {
      throw new Error(
        "SendGridProvider: SENDGRID_API_KEY is required (no key in source).",
      );
    }
    this.apiKey = apiKey;
    const fromDomain = opts.fromDomain ?? env.SENDGRID_FROM_DOMAIN;
    this.fromEmail =
      opts.fromEmail ??
      env.SENDGRID_FROM_EMAIL ??
      (fromDomain ? `offers@${fromDomain}` : "");
    this.replyTo =
      opts.replyTo ?? env.SENDGRID_REPLY_TO ?? env.OUTREACH_REPLY_TO ?? "";
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async send(msg: OutboundEmail): Promise<SendResult> {
    // Faithful SendGrid v3 mail-send payload.
    const payload = {
      personalizations: [{ to: [{ email: msg.to }] }],
      from: { email: this.fromEmail || msg.from, name: msg.fromName },
      reply_to: { email: this.replyTo || msg.replyTo },
      subject: msg.subject,
      content: [{ type: "text/plain", value: msg.body }],
    };

    const res = await this.fetchImpl("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (res.status !== 202) {
      throw new Error(`SendGridProvider: expected 202, got ${res.status}`);
    }
    // SendGrid returns the provider message id in the X-Message-Id header.
    const providerId = res.headers.get("x-message-id") ?? "";
    return { providerId, status: "sent" };
  }
}

export type ProviderKind = "mock" | "sendgrid";

/** Factory on EMAIL_PROVIDER (mock|sendgrid). Defaults to the mock. */
export function makeProvider(
  env: EnvLike = ambientEnv(),
): EmailProvider {
  const kind = (env.EMAIL_PROVIDER ?? "mock") as ProviderKind;
  if (kind === "sendgrid") return new SendGridProvider();
  return new MockProvider();
}
