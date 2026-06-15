// Centralized env reads. NO secrets in source — everything comes from process.env.
// Keeping the reads here keeps the rest of the module pure and testable: callers
// pass an `OutreachConfig` so tests never depend on ambient environment.
import type { EnvLike } from "./env.js";
import { ambientEnv } from "./env.js";

export interface OutreachConfig {
  /** Physical mailing address — REQUIRED by CAN-SPAM in every footer. */
  mailingAddress: string;
  /** Base URL of the one-click unsubscribe endpoint (token appended as ?t=). */
  unsubscribeBaseUrl: string;
  /** Monitored reply-to inbox (a real human watches this). */
  replyTo: string;
  /** Friendly from name shown to the owner. */
  fromName: string;
}

/** Read the compliance/config values from the environment, with safe-ish defaults. */
export function configFromEnv(env: EnvLike = ambientEnv()): OutreachConfig {
  return {
    mailingAddress:
      env.MAILING_ADDRESS ?? "Parcel LLC, PO Box 0000, Billings, MT 59101",
    unsubscribeBaseUrl:
      env.UNSUBSCRIBE_BASE_URL ?? "https://parcel.example/unsubscribe",
    replyTo: env.OUTREACH_REPLY_TO ?? "offers@parcel.example",
    fromName: env.OUTREACH_FROM_NAME ?? "Parcel Home Buyers",
  };
}
