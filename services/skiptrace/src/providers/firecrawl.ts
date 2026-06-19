// Real-shape Firecrawl skip-trace integration. Uses the Firecrawl v2 Search
// endpoint with structured JSON extraction to pull owner contact info from
// PERMITTED public records (county assessor/recorder, public people-search that
// allow it). Reads the key from env — never from source (§7.4). Maps the result
// into an OwnerHit (or null when unmatched). Not exercised live in tests.
//
// COMPLIANCE: respect provider ToS (PRD §8.4). Zillow/Redfin et al. are denied.
import type { Property, OwnerHit } from "@parcel/types";
import { isPermitted } from "@parcel/scrape/compliance";
import type { SkipTraceProvider } from "../provider.js";

const FIRECRAWL_SEARCH_URL = "https://api.firecrawl.dev/v2/search";

interface ExtractedOwner {
  full_name?: string;
  email?: string;
  phone?: string;
  mailing_address?: string;
  /** Optional self-reported confidence 0..1 from the extraction. */
  confidence?: number;
}
interface FirecrawlResult {
  url?: string;
  json?: ExtractedOwner;
}
interface FirecrawlResponse {
  data?: { web?: FirecrawlResult[] } | FirecrawlResult[];
}

const OWNER_SCHEMA = {
  type: "object",
  properties: {
    full_name: { type: "string" },
    email: { type: "string" },
    phone: { type: "string" },
    mailing_address: { type: "string" },
  },
} as const;

export interface FirecrawlProviderOptions {
  apiKey?: string;
  /** Base confidence assigned to a found contact (skip-trace from records is fuzzy). */
  baseConfidence?: number;
}

export class FirecrawlProvider implements SkipTraceProvider {
  private readonly apiKey: string;
  private readonly baseConfidence: number;

  constructor(opts: FirecrawlProviderOptions = {}) {
    const apiKey = opts.apiKey ?? process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      throw new Error(
        "FirecrawlProvider: FIRECRAWL_API_KEY is not set. " +
          "Set it in the environment or use PROPERTY_PROVIDER=mock.",
      );
    }
    this.apiKey = apiKey;
    this.baseConfidence = opts.baseConfidence ?? 0.55;
  }

  async trace(property: Property): Promise<OwnerHit | null> {
    const res = await fetch(FIRECRAWL_SEARCH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: buildQuery(property),
        limit: 5,
        scrapeOptions: { formats: [{ type: "json", schema: OWNER_SCHEMA }] },
      }),
    });

    if (!res.ok) {
      throw new Error(
        `FirecrawlProvider: ${res.status} ${res.statusText} from Firecrawl`,
      );
    }

    const json = (await res.json()) as FirecrawlResponse;
    const results = extractResults(json).filter((r) => !!r.url && isPermitted(r.url));

    // Take the first result that yields at least a name or an email.
    for (const r of results) {
      const e = r.json;
      if (e && (e.full_name || e.email || e.phone)) {
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

function extractResults(json: FirecrawlResponse): FirecrawlResult[] {
  const data = json.data;
  if (Array.isArray(data)) return data;
  return data?.web ?? [];
}

function mapOwner(e: ExtractedOwner, property: Property, base: number): OwnerHit {
  // More fields found → higher confidence, capped at a fuzzy ceiling.
  const found = [e.full_name, e.email, e.phone, e.mailing_address].filter(Boolean).length;
  const confidence = Math.max(
    0,
    Math.min(1, typeof e.confidence === "number" ? e.confidence : base + 0.1 * (found - 1)),
  );
  return {
    full_name: e.full_name ?? null,
    email: e.email ?? null,
    phone: e.phone ?? null,
    mailing_address: e.mailing_address ?? property.address,
    confidence,
  };
}
