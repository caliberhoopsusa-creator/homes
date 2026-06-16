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

// A candidate from a PropertyProvider, before it becomes a `properties` row.
export const propertyCandidate = z.object({
  source: z.enum(["attom", "batchdata", "firecrawl", "manual"]),
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
  fee_target: z.number().nonnegative().default(12000),
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
