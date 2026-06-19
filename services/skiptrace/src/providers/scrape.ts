// Self-hosted scrape skip-trace — resolves owner contact info from PERMITTED
// public records (county assessor/recorder, public people-search that allow it)
// using @parcel/scrape, our own crawl+extract engine (no paid scrape API).
// Provider seam (§7.4): defaults to the keyless mock engine; opt in to the real
// one with SCRAPE_ENGINE=selfhosted. Maps a result into an OwnerHit or null.
//
// COMPLIANCE: the engine enforces the ToS denylist at its boundary (PRD §8.4),
// and we keep owner PII out of logs (none emitted here).
import type { Property, OwnerHit } from "@parcel/types";
import {
  createScrapeEngine,
  type ScrapeEngine,
  type ExtractSchema,
} from "@parcel/scrape";
import type { SkipTraceProvider } from "../provider.js";

const OWNER_SCHEMA: ExtractSchema = {
  type: "object",
  properties: {
    full_name: { type: "string" },
    email: { type: "string" },
    phone: { type: "string" },
    mailing_address: { type: "string" },
  },
};

interface ExtractedOwner {
  full_name?: string;
  email?: string;
  phone?: string;
  mailing_address?: string;
}

export interface ScrapeProviderOptions {
  engine?: ScrapeEngine;
  /** Base confidence assigned to a found contact (record skip-trace is fuzzy). */
  baseConfidence?: number;
  /** Max search results to consider per property. */
  limit?: number;
}

export class ScrapeProvider implements SkipTraceProvider {
  private readonly engine: ScrapeEngine;
  private readonly baseConfidence: number;
  private readonly limit: number;

  constructor(opts: ScrapeProviderOptions = {}) {
    this.engine = opts.engine ?? createScrapeEngine();
    this.baseConfidence = opts.baseConfidence ?? 0.55;
    this.limit = opts.limit ?? 5;
  }

  async trace(property: Property): Promise<OwnerHit | null> {
    const results = await this.engine.search(buildQuery(property), {
      limit: this.limit,
      schema: OWNER_SCHEMA,
    });
    // Take the first result that yields at least a name, email, or phone.
    for (const r of results) {
      const e = (r.json ?? {}) as ExtractedOwner;
      if (e.full_name || e.email || e.phone) {
        return mapOwner(e, property, this.baseConfidence);
      }
    }
    return null;
  }
}

function buildQuery(property: Property): string {
  const parts = [property.address, property.city, property.state, property.zip]
    .filter(Boolean)
    .join(" ");
  return `property owner of record contact ${parts}`;
}

function mapOwner(e: ExtractedOwner, property: Property, base: number): OwnerHit {
  // More fields found → higher confidence, capped at a fuzzy ceiling.
  const found = [e.full_name, e.email, e.phone, e.mailing_address].filter(Boolean).length;
  const confidence = Math.max(0, Math.min(1, base + 0.1 * (found - 1)));
  return {
    full_name: e.full_name ?? null,
    email: e.email ?? null,
    phone: e.phone ?? null,
    mailing_address: e.mailing_address ?? property.address,
    confidence,
  };
}
