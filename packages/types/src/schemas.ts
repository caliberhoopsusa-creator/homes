// Shared zod schemas — the cross-service validation contract.
// Services validate provider input/output and webhook payloads against these.
import { z } from "zod";

export const distressSignal = z.enum([
  "tax_delinquent",
  "preforeclosure",
  "vacant",
  "absentee",
]);

export const verdict = z.enum(["clear", "thin", "pass"]);

export const replyIntent = z.enum([
  "interested",
  "maybe",
  "not_now",
  "do_not_contact",
  "unknown",
]);

export const dealStage = z.enum([
  "Lead",
  "Contacted",
  "Under contract",
  "Assigned",
  "Closed",
]);

export const messageKind = z.enum(["seller_outreach", "buyer_dispo"]);

export const closingPhase = z.enum([
  "contract_to_assignment",
  "buyer_selection",
  "due_diligence",
  "closing_prep",
  "closing_day",
]);

export const closingTaskStatus = z.enum(["pending", "done"]);

// Public SMS opt-in submission. `consent` MUST be true (explicit opt-in) — the
// TCPA paper trail. Phone is validated loosely here; normalized server-side.
export const smsOptInInput = z.object({
  phone: z.string().min(7).max(20),
  consent: z.literal(true),
  source: z.string().max(40).optional(),
});
export type SmsOptInInput = z.infer<typeof smsOptInInput>;

// A candidate from a PropertyProvider, before it becomes a `properties` row.
export const propertyCandidate = z.object({
  source: z.enum(["attom", "batchdata", "firecrawl", "county", "manual"]),
  source_id: z.string().nullable(),
  address: z.string().min(1),
  city: z.string().nullable(),
  state: z.string().nullable(),
  zip: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  beds: z.number().int().nullable(),
  baths: z.number().nullable(),
  sqft: z.number().int().nullable(),
  year_built: z.number().int().nullable(),
  est_value: z.number().nullable(),
  asking: z.number().nullable(),
  distress_signals: z.array(distressSignal).default([]),
});
export type PropertyCandidate = z.infer<typeof propertyCandidate>;

// A skip-trace hit, before it becomes an `owners` row.
export const ownerHit = z.object({
  full_name: z.string().nullable(),
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
  mailing_address: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});
export type OwnerHit = z.infer<typeof ownerHit>;

// The inputs to the underwriting engine.
export const underwriteInput = z.object({
  arv: z.number().nonnegative(),
  repairs: z.number().nonnegative(),
  asking: z.number().nonnegative(),
  rule_pct: z.number().positive().max(1).default(0.7),
  fee_target: z.number().nonnegative().default(10000),
  // Itemized-MAO inputs (Max's full formula). When omitted, the engine uses the
  // 70% rule. buyer_profit_pct is a fraction of ARV (his 0.15–0.20).
  holding_costs: z.number().nonnegative().optional(),
  closing_costs: z.number().nonnegative().optional(),
  buyer_profit_pct: z.number().min(0).max(1).optional(),
});
export type UnderwriteInput = z.infer<typeof underwriteInput>;

// A radius pull request (sourcing entrypoint + desk trigger button).
export const radiusPullRequest = z.object({
  lat: z.number(),
  lng: z.number(),
  radiusMiles: z.number().positive(),
  filters: z
    .object({
      minBeds: z.number().int().optional(),
      distress: z.array(distressSignal).optional(),
    })
    .default({}),
});
export type RadiusPullRequest = z.infer<typeof radiusPullRequest>;
