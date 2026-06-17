// The 6-touch sequence (PRD §6.4, extended per docs/AUTOMATION-PLAN.md to mirror
// Max Maxwell's 30-day seller follow-up). Six touches at day 0 / 3 / 7 / 14 / 21 /
// 30, ONE CTA each. Touch 1 is plain-text-feel: NO images, NO links (the
// unsubscribe footer is required by law and is the only link, kept plain on touch 1).
//
// MT broker line (CLAUDE.md #4): we market AN OFFER TO BUY, never the property
// FOR SALE. Subjects/bodies are truthful and reference only real tokens.
import type { Owner, Property } from "@parcel/types";
import type { OutreachConfig } from "./config.js";
import { withFooter } from "./compliance.js";

export interface SequenceStep {
  /** 1-based touch number. */
  step: number;
  /** Day offset from campaign start when this touch is due. */
  dayOffset: number;
  /** Subject line template (truthful — an offer to buy). */
  subject: string;
  /** Body template with {{token}} placeholders. */
  body: string;
  /** Touch 1 is link/image-free for deliverability ("plain-text feel"). */
  plainTextOnly: boolean;
}

/** Templates as data. {{address}} and {{neighborhood}} are the only real tokens. */
export const SEQUENCE: readonly SequenceStep[] = [
  {
    step: 1,
    dayOffset: 0,
    plainTextOnly: true,
    subject: "Quick question about {{address}}",
    body: [
      "Hi,",
      "",
      "I buy homes in {{neighborhood}} and came across {{address}}.",
      "Would you consider a cash offer on {{address}}? No fees, no listing,",
      "and you pick the closing date.",
      "",
      "Just reply to this email and I'll send a number.",
    ].join("\n"),
  },
  {
    step: 2,
    dayOffset: 3,
    plainTextOnly: false,
    subject: "A cash offer on {{address}}",
    body: [
      "Hi,",
      "",
      "Following up on {{address}} in {{neighborhood}}.",
      "Would you consider a cash offer? I can close on your timeline and",
      "cover typical closing costs.",
      "",
      "Reply here and I'll put together an offer.",
    ].join("\n"),
  },
  {
    step: 3,
    dayOffset: 7,
    plainTextOnly: false,
    subject: "Comparable sales near {{address}}",
    body: [
      "Hi,",
      "",
      "Following up on {{address}} in {{neighborhood}}. I base my offers on",
      "recent comparable sales nearby, and I'm happy to walk you through how",
      "I'd arrive at a number for your place.",
      "",
      "Reply here and I'll put an offer together.",
    ].join("\n"),
  },
  {
    step: 4,
    dayOffset: 14,
    plainTextOnly: false,
    subject: "Still able to make a cash offer on {{address}}",
    body: [
      "Hi,",
      "",
      "Checking back on {{address}}. My offer to buy still stands — cash, no",
      "fees or listing, and you choose the closing date.",
      "",
      "If the timing is better now, just reply and I'll send a number.",
    ].join("\n"),
  },
  {
    step: 5,
    dayOffset: 21,
    plainTextOnly: false,
    subject: "Anything I can answer about selling {{address}}?",
    body: [
      "Hi,",
      "",
      "If you've been weighing a sale of {{address}}, I'm glad to answer any",
      "questions about how a cash purchase works and what I could offer.",
      "",
      "Reply here whenever it's useful.",
    ].join("\n"),
  },
  {
    step: 6,
    dayOffset: 30,
    plainTextOnly: false,
    subject: "Last note on {{address}}",
    body: [
      "Hi,",
      "",
      "Last time I'll reach out about {{address}}.",
      "If selling for cash is something you'd consider, just reply and I'll",
      "send an offer. If not, no problem at all.",
    ].join("\n"),
  },
] as const;

/** Look up a step's template; throws if the step is out of range. */
export function stepTemplate(step: number): SequenceStep {
  const t = SEQUENCE.find((s) => s.step === step);
  if (!t) throw new Error(`outreach: no sequence template for step ${step}`);
  return t;
}

export interface BuiltMessage {
  step: number;
  subject: string;
  /** Final body INCLUDING the CAN-SPAM footer. */
  body: string;
  plainTextOnly: boolean;
}

/**
 * Build a personalized message for an owner+property at a given step. The
 * personalizer fills the 1–2 real tokens; this function then guarantees the
 * compliance footer (mailing address + per-owner unsubscribe) is appended.
 *
 * `fill` is the substitution function from a Personalizer (kept as a param so
 * this builder stays pure and provider-agnostic).
 */
export function buildMessage(args: {
  owner: Owner;
  property: Property;
  step: number;
  cfg: OutreachConfig;
  fill: (template: string, tokens: Record<string, string>) => string;
}): BuiltMessage {
  const t = stepTemplate(args.step);
  const tokens = realTokens(args.property);
  const subject = args.fill(t.subject, tokens);
  const personalizedBody = args.fill(t.body, tokens);
  const body = withFooter(personalizedBody, args.owner.id, args.cfg);
  return { step: t.step, subject, body, plainTextOnly: t.plainTextOnly };
}

/** Only REAL tokens — never fake familiarity (PRD §6.4 / Personalizer rule). */
export function realTokens(property: Property): Record<string, string> {
  const address = property.address;
  // neighborhood = best truthful locality we actually know (city), never invented.
  const neighborhood = property.city ?? property.zip ?? "your area";
  return { address, neighborhood };
}
