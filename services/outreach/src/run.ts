// Campaign runner (PRD §6.4). Reads clearing owners through the injected store,
// honors the suppression list, personalizes, sends via the EmailProvider, and
// logs every `messages` row with status transitions (queued → sent).
//
// Talks to other services ONLY through Postgres tables (§7.4) — here via the
// injected OutreachStore. NO DB client or live SDK is imported in this module.
import type {
  Campaign,
  Message,
  MessageInsert,
  MessageStatus,
  Owner,
  Property,
} from "@parcel/types";
import type { OutreachConfig } from "./config.js";
import { configFromEnv } from "./config.js";
import type { EmailProvider } from "./provider.js";
import { MockProvider } from "./provider.js";
import type { Personalizer } from "./personalizer.js";
import { MockPersonalizer } from "./personalizer.js";
import { buildMessage } from "./sequence.js";
import { isCompliant } from "./compliance.js";

/** Owner attached to a clearing property (verdict='clear'). */
export interface ClearingOwner {
  owner: Owner;
  property: Property;
}

/**
 * Injected data access. The runner depends only on this interface, never on a DB
 * client — so it is fully unit-testable against fakes.
 */
export interface OutreachStore {
  /** Owners whose property has an underwrite verdict='clear'. */
  clearingOwners(): Promise<ClearingOwner[]>;
  /** True if the email is on the suppression list (do_not_contact | unsubscribe). */
  isSuppressed(email: string): Promise<boolean>;
  /** Persist a `messages` row; returns its id. */
  insertMessage(row: MessageInsert): Promise<{ id: string }>;
  /** Record a status transition for a message (e.g. queued → sent). */
  recordStatus(messageId: string, status: MessageStatus): Promise<void>;
  /** Count of messages already sent today for the daily-cap ramp. */
  sentTodayCount(campaignId: string): Promise<number>;
}

export interface OutreachDeps {
  store: OutreachStore;
  provider?: EmailProvider;
  personalizer?: Personalizer;
  config?: OutreachConfig;
}

export interface RunCampaignOptions {
  campaign: Campaign;
  /** Which touch to send this run (1 | 2 | 3). Defaults to 1. */
  step?: number;
  /**
   * Ramp factor in [0,1] applied to the campaign daily_cap to warm the domain.
   * effective cap = floor(daily_cap * ramp). Defaults to 1 (full cap).
   */
  ramp?: number;
  /** From email for truthful headers; falls back to the campaign domain. */
  fromEmail?: string;
}

export interface RunCampaignResult {
  considered: number;
  suppressed: number;
  capped: number;
  sent: number;
  messageIds: string[];
}

/**
 * Run one pass of the sequence for a campaign. For each clearing owner with an
 * email, in cap order: skip if suppressed, build a compliant personalized
 * message, log it queued, send it, then transition queued → sent.
 */
export async function runCampaign(
  deps: OutreachDeps,
  opts: RunCampaignOptions,
): Promise<RunCampaignResult> {
  const store = deps.store;
  const provider = deps.provider ?? new MockProvider();
  const personalizer = deps.personalizer ?? new MockPersonalizer();
  const cfg = deps.config ?? configFromEnv();
  const step = opts.step ?? 1;

  const fromEmail =
    opts.fromEmail ??
    (opts.campaign.from_domain ? `offers@${opts.campaign.from_domain}` : "offers@parcel.example");

  // Daily-cap ramp: warm the sending domain by sending a fraction of the cap.
  const ramp = clamp01(opts.ramp ?? 1);
  const effectiveCap = Math.floor(opts.campaign.daily_cap * ramp);
  const alreadySent = await store.sentTodayCount(opts.campaign.id);
  let remaining = Math.max(0, effectiveCap - alreadySent);

  const result: RunCampaignResult = {
    considered: 0,
    suppressed: 0,
    capped: 0,
    sent: 0,
    messageIds: [],
  };

  const owners = await store.clearingOwners();

  for (const { owner, property } of owners) {
    const email = owner.email?.trim();
    if (!email) continue; // can't contact without an address
    result.considered += 1;

    // Daily cap: once exhausted, everything else is deferred to the next run.
    if (remaining <= 0) {
      result.capped += 1;
      continue;
    }

    // Suppression list is a HARD gate — suppressed owners are NEVER messaged.
    if (await store.isSuppressed(email)) {
      result.suppressed += 1;
      continue;
    }

    const built = buildMessage({ owner, property, step, cfg, fill: personalizer.fill.bind(personalizer) });

    // Defense in depth: never let a non-compliant body reach the wire.
    if (!isCompliant(built.body, owner.id, cfg)) {
      throw new Error(
        `outreach: refusing to send non-compliant body to owner ${owner.id}`,
      );
    }

    // Log queued first so a crash mid-send leaves an auditable row.
    const queued: MessageInsert = {
      campaign_id: opts.campaign.id,
      owner_id: owner.id,
      step: built.step,
      direction: "outbound",
      subject: built.subject,
      body: built.body,
      status: "queued",
      provider_id: null,
      sent_at: null,
    } satisfies Partial<Message> as MessageInsert;

    const { id } = await store.insertMessage(queued);

    await provider.send({
      to: email,
      from: fromEmail,
      fromName: cfg.fromName,
      replyTo: cfg.replyTo,
      subject: built.subject,
      body: built.body,
    });

    // queued → sent transition.
    await store.recordStatus(id, "sent");

    remaining -= 1;
    result.sent += 1;
    result.messageIds.push(id);
  }

  return result;
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 1;
  return Math.max(0, Math.min(1, n));
}
