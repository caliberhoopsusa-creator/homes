// Self-hosted scrape sourcing — turns PERMITTED public sources (county
// tax-delinquent / foreclosure lists, FSBO, public records) into
// PropertyCandidate[] using @parcel/scrape, our own crawl+extract engine (no
// paid scrape API). Provider seam (§7.4): the engine defaults to the keyless
// mock; opt in to the real one with SCRAPE_ENGINE=selfhosted.
//
// COMPLIANCE (PRD §8.4): the engine enforces the Zillow/Redfin/Trulia/Realtor
// denylist at its boundary, so denied pages never reach this mapper.
import type { RadiusPullRequest, PropertyCandidate } from "@parcel/types";
import {
  createScrapeEngine,
  type ScrapeEngine,
  type ExtractSchema,
} from "@parcel/scrape";
import type { PropertyProvider } from "../provider.js";
import { normalizeDistress } from "../normalize.js";

const EXTRACT_SCHEMA: ExtractSchema = {
  type: "object",
  properties: {
    address: { type: "string" },
    city: { type: "string" },
    state: { type: "string" },
    zip: { type: "string" },
    beds: { type: "number" },
    baths: { type: "number" },
    sqft: { type: "number" },
    year_built: { type: "number" },
    est_value: { type: "number" },
    asking: { type: "number" },
    distress_signals: { type: "array", items: { type: "string" } },
  },
};

interface Extracted {
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  beds?: number;
  baths?: number;
  sqft?: number;
  year_built?: number;
  est_value?: number;
  asking?: number;
  distress_signals?: string[];
}

export interface ScrapeProviderOptions {
  engine?: ScrapeEngine;
  /** Place name used to localize the search (lat/lng alone is weak for text search). */
  region?: string;
  /** Max results to scrape per pull. */
  limit?: number;
}

export class ScrapeProvider implements PropertyProvider {
  private readonly engine: ScrapeEngine;
  private readonly region: string;
  private readonly limit: number;

  constructor(opts: ScrapeProviderOptions = {}) {
    this.engine = opts.engine ?? createScrapeEngine();
    this.region = opts.region ?? process.env.SCRAPE_REGION ?? "Billings, MT";
    this.limit = opts.limit ?? 50;
  }

  async search(req: RadiusPullRequest): Promise<PropertyCandidate[]> {
    const results = await this.engine.search(buildQuery(req, this.region), {
      limit: this.limit,
      region: this.region,
      schema: EXTRACT_SCHEMA,
    });
    return results
      .map((r) => mapResult(r.url, (r.json ?? {}) as Extracted, r.title, req))
      .filter((c): c is PropertyCandidate => c !== null);
  }
}

/** Build a permitted-source search query from the request + region. */
function buildQuery(req: RadiusPullRequest, region: string): string {
  const override = process.env.SCRAPE_SOURCING_QUERY;
  if (override) return override;
  const distress = req.filters.distress?.length
    ? req.filters.distress.join(" OR ").replace(/_/g, " ")
    : "distressed OR tax delinquent OR pre-foreclosure";
  // Bias toward FSBO / public-record style results, not brokered listings.
  return `${distress} property for sale by owner ${region}`;
}

function mapResult(
  url: string,
  e: Extracted,
  title: string | undefined,
  req: RadiusPullRequest,
): PropertyCandidate | null {
  const address = e.address ?? title ?? "";
  if (!address) return null;

  // Prefer extracted distress tags; fall back to the request's filter intent.
  const tags = e.distress_signals?.length ? e.distress_signals : (req.filters.distress ?? []);

  return {
    source: "scrape",
    source_id: url || null, // the page URL is the stable id for dedupe
    address,
    city: e.city ?? null,
    state: e.state ?? null,
    zip: e.zip ?? null,
    lat: null, // geocoded downstream; scraped results aren't geocoded
    lng: null,
    beds: e.beds ?? null,
    baths: e.baths ?? null,
    sqft: e.sqft ?? null,
    year_built: e.year_built ?? null,
    est_value: e.est_value ?? null,
    asking: e.asking ?? null,
    distress_signals: normalizeDistress(tags),
  };
}
