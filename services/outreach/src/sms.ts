// Consent-only SMS (TCPA-safe by construction). Texting someone without their
// prior express written consent is a TCPA violation ($500–$1,500 per message),
// so the send path REQUIRES a consent flag and a suppression check — cold texting
// is impossible here. Mock default; Twilio behind a key (real shape, not run live).
//
// You still need, externally: a Twilio account, a registered number/10DLC
// campaign, a documented opt-in source per recipient, and STOP/HELP auto-replies.
import { createHmac, timingSafeEqual } from "node:crypto";
import type { EnvLike, FetchLike } from "./env.js";
import { ambientEnv, ambientFetch } from "./env.js";

export interface OutboundSms {
  to: string;
  from: string;
  body: string;
}

export interface SmsSendResult {
  providerId: string;
  status: "sent";
}

export interface SmsProvider {
  send(msg: OutboundSms): Promise<SmsSendResult>;
}

/** Default provider — records sends in memory; transmits nothing. */
export class MockSmsProvider implements SmsProvider {
  readonly sent: OutboundSms[] = [];
  private seq = 0;
  async send(msg: OutboundSms): Promise<SmsSendResult> {
    this.sent.push(msg);
    this.seq += 1;
    return { providerId: `mock-sms-${this.seq}`, status: "sent" };
  }
}

export interface TwilioSmsProviderOptions {
  accountSid?: string;
  authToken?: string;
  fetchImpl?: FetchLike;
}

/** Real-shape Twilio Messages API. Throws if creds are missing. Not run live in tests. */
export class TwilioSmsProvider implements SmsProvider {
  private readonly accountSid: string;
  private readonly authToken: string;
  private readonly fetchImpl: FetchLike;

  constructor(opts: TwilioSmsProviderOptions = {}) {
    const env = ambientEnv();
    const sid = opts.accountSid ?? env.TWILIO_ACCOUNT_SID;
    const token = opts.authToken ?? env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) {
      throw new Error(
        "TwilioSmsProvider: TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN required (no secrets in source).",
      );
    }
    this.accountSid = sid;
    this.authToken = token;
    this.fetchImpl = opts.fetchImpl ?? ambientFetch();
  }

  async send(msg: OutboundSms): Promise<SmsSendResult> {
    const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64");
    const body = new URLSearchParams({ To: msg.to, From: msg.from, Body: msg.body });
    const res = await this.fetchImpl(
      `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          authorization: `Basic ${auth}`,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      },
    );
    if (res.status !== 201 && res.status !== 200) {
      throw new Error(`TwilioSmsProvider: expected 201, got ${res.status}`);
    }
    const json = (await res.json().catch(() => ({}))) as { sid?: string };
    return { providerId: json.sid ?? "", status: "sent" };
  }
}

export type SmsProviderKind = "off" | "mock" | "twilio";

/** Factory on SMS_PROVIDER (off|mock|twilio). Default off — SMS is opt-in. */
export function makeSmsProvider(env: EnvLike = ambientEnv()): SmsProvider | null {
  const kind = (env.SMS_PROVIDER ?? "off") as SmsProviderKind;
  if (kind === "twilio") return new TwilioSmsProvider();
  if (kind === "mock") return new MockSmsProvider();
  return null; // "off": SMS disabled
}

export interface SmsRecipientState {
  /** Prior express consent on file (with a documented opt-in source). */
  hasConsent: boolean;
  /** On the STOP/suppression list. */
  suppressed: boolean;
}

/**
 * TCPA hard gate — call before every SMS send. Throws unless the recipient has
 * consent and isn't suppressed. This is what makes cold texting impossible.
 */
export function assertTextable(state: SmsRecipientState): void {
  if (!state.hasConsent) {
    throw new Error("SMS blocked: no prior express consent on file (TCPA).");
  }
  if (state.suppressed) {
    throw new Error("SMS blocked: recipient opted out (STOP).");
  }
}

/**
 * Validate Twilio's X-Twilio-Signature on an inbound webhook. Twilio signs the
 * full request URL plus the POST params (sorted by key, concatenated) with
 * HMAC-SHA1 keyed by the auth token, base64-encoded. Returns true if it matches.
 * Reject inbound webhooks that fail this before trusting them.
 */
export function validateTwilioSignature(args: {
  authToken: string;
  url: string;
  params: Record<string, string>;
  signature: string | null;
}): boolean {
  if (!args.signature) return false;
  let data = args.url;
  for (const key of Object.keys(args.params).sort()) {
    data += key + args.params[key];
  }
  const expected = createHmac("sha1", args.authToken).update(data, "utf8").digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(args.signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

const STOP_WORDS = ["stop", "stopall", "unsubscribe", "cancel", "end", "quit", "revoke"];
const HELP_WORDS = ["help", "info"];

/** Classify an inbound text for STOP/HELP auto-handling (carrier requirement). */
export function smsKeyword(body: string): "stop" | "help" | null {
  const w = body.trim().toLowerCase();
  if (STOP_WORDS.includes(w)) return "stop";
  if (HELP_WORDS.includes(w)) return "help";
  return null;
}
