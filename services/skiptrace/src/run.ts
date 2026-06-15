// Runner: resolve owner contact info for properties lacking a matched owner.
// Talks to the rest of the system only through Postgres (§7.4); the DB is injected
// via SkiptraceStore so this stays unit-testable and provider-agnostic.
//
// CRITICAL RULE: never overwrite a higher-confidence existing match. The store
// exposes the current confidence so we skip any downgrade.
import type { Property, OwnerHit } from "@parcel/types";
import { ownerHit as ownerHitSchema } from "@parcel/types";
import type { SkipTraceProvider } from "./provider.js";

export interface SkiptraceStore {
  /** Properties with no matched owner yet (status pending or none). */
  propertiesWithoutMatchedOwner(): Promise<Property[]>;
  /**
   * Current owner-match confidence for a property, or null if none.
   * Used to enforce the no-downgrade rule before upserting.
   */
  currentConfidence(propertyId: string): Promise<number | null>;
  /** Insert or update the owner row + set skiptrace_status accordingly. */
  upsertOwner(propertyId: string, hit: OwnerHit): Promise<void>;
  /** Record that a property could not be matched (status -> "none"). */
  markNone(propertyId: string): Promise<void>;
}

export interface SkiptraceResult {
  /** Properties attempted. */
  traced: number;
  /** Properties that ended with a matched owner written this run. */
  matched: number;
  /** Matches skipped because an equal/higher-confidence owner already exists. */
  skippedDowngrade: number;
}

/** Trace every unmatched property; never downgrade an existing match. */
export async function runSkiptrace(
  provider: SkipTraceProvider,
  store: SkiptraceStore,
): Promise<SkiptraceResult> {
  const properties = await store.propertiesWithoutMatchedOwner();
  let matched = 0;
  let skippedDowngrade = 0;

  for (const p of properties) {
    const hit = await provider.trace(p);

    if (!hit || !ownerHitSchema.safeParse(hit).success) {
      await store.markNone(p.id);
      continue;
    }

    const current = await store.currentConfidence(p.id);
    if (current !== null && current >= hit.confidence) {
      // A same- or higher-confidence match already exists — never downgrade.
      skippedDowngrade++;
      continue;
    }

    await store.upsertOwner(p.id, hit);
    matched++;
  }

  return { traced: properties.length, matched, skippedDowngrade };
}
