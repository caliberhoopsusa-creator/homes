// Real-shape Firecrawl integration. Uses the Firecrawl v2 Search endpoint with
// structured JSON extraction to turn PERMITTED public sources (county
// tax-delinquent / foreclosure lists, FSBO, public records) into
// PropertyCandidate[]. Reads the key from env — never from source (§7.4).
//
// COMPLIANCE (PRD §8.4): we do NOT scrape Zillow/Redfin/Trulia (ToS + legal
// risk). Those domains are hard-denied below; an optional allowlist narrows
// further. Not exercised live in tests; it is a faithful, typed integration.
import type { RadiusPullRequest, PropertyCandidate } from "@parcel/types";
import type { PropertyProvider } from "../provider.js";
import { normalizeDistress } from "../normalize.js";

const FIRECRAWL_SEARCH_URL = "https://api.firecrawl.dev/v2/search";

/** Domains we must never scrape (ToS). Checked against each result URL. */
const DENY_DOMAINS = ["zillow.com", "redfin.com", "trulia.com", "realtor.com"];

// The structured shape we ask Firecrawl to extract from each result page.
interface ExtractedProperty {
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
interface FirecrawlSearchResult {
  url?: string;
  title?: string;
  json?: ExtractedProperty;
}
interface FirecrawlSearchResponse {
  data?: { web?: FirecrawlSearchResult[] } | FirecrawlSearchResult[];
  // Some deployments return { success, data: [...] }; handle both below.
}

const EXTRACT_SCHEMA = {
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
} as const;

export interface FirecrawlProviderOptions {
  apiKey?: string;
  /** Place name used to localize the search (lat/lng alone is poor for text search). */
  region?: string;
  /** Optional allowlist of permitted source domains; empty = allow all but the denylist. */
  allowDomains?: string[];
}

export class FirecrawlProvider implements PropertyProvider {
  private readonly apiKey: string;
  private readonly region: string;
  private readonly allow: string[];

  constructor(opts: FirecrawlProviderOptions = {}) {
    const apiKey = opts.apiKey ?? process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      throw new Error(
        "FirecrawlProvider: FIRECRAWL_API_KEY is not set. " +
          "Set it in the environment or use PROPERTY_PROVIDER=mock.",
      );
    }
    this.apiKey = apiKey;
    this.region = opts.region ?? process.env.FIRECRAWL_REGION ?? "Billings, MT";
    this.allow =
      opts.allowDomains ??
      (process.env.FIRECRAWL_ALLOW_DOMAINS
        ? process.env.FIRECRAWL_ALLOW_DOMAINS.split(",").map((d) => d.trim())
        : []);
  }

  async search(req: RadiusPullRequest): Promise<PropertyCandidate[]> {
    const res = await fetch(FIRECRAWL_SEARCH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: buildQuery(req, this.region),
        limit: 50,
        // Ask Firecrawl to scrape each result and return our structured JSON.
        scrapeOptions: {
          formats: [{ type: "json", schema: EXTRACT_SCHEMA }],
        },
      }),
    });

    if (!res.ok) {
      throw new Error(
        `FirecrawlProvider: ${res.status} ${res.statusText} from Firecrawl`,
      );
    }

    const json = (await res.json()) as FirecrawlSearchResponse;
    const results = extractResults(json);
    return results
      .filter((r) => r.url && isPermitted(r.url, this.allow))
      .map((r) => mapResult(r, req))
      .filter((c): c is PropertyCandidate => c !== null);
  }
}

/** Build a permitted-source search query from the request + region. */
function buildQuery(req: RadiusPullRequest, region: string): string {
  const override = process.env.FIRECRAWL_SOURCING_QUERY;
  if (override) return override;
  const distress = req.filters.distress?.length
    ? req.filters.distress.join(" OR ").replace(/_/g, " ")
    : "distressed OR tax delinquent OR pre-foreclosure";
  // Bias toward FSBO / public-record style results, not brokered listings.
  return `${distress} property for sale by owner ${region}`;
}

function extractResults(json: FirecrawlSearchResponse): FirecrawlSearchResult[] {
  const data = json.data;
  if (Array.isArray(data)) return data;
  return data?.web ?? [];
}

/** True unless the host is on the denylist (and, if an allowlist exists, on it). */
function isPermitted(url: string, allow: string[]): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return false;
  }
  if (DENY_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`))) return false;
  if (allow.length > 0) return allow.some((d) => host === d || host.endsWith(`.${d}`));
  return true;
}

function mapResult(r: FirecrawlSearchResult, req: RadiusPullRequest): PropertyCandidate | null {
  const e = r.json ?? {};
  const address = e.address ?? r.title ?? "";
  if (!address) return null;

  // Prefer extracted distress tags; fall back to the request's filter intent.
  const tags = e.distress_signals?.length ? e.distress_signals : (req.filters.distress ?? []);

  return {
    source: "firecrawl",
    source_id: r.url ?? null, // the page URL is the stable id for dedupe
    address,
    city: e.city ?? null,
    state: e.state ?? null,
    zip: e.zip ?? null,
    lat: null, // geocoded downstream; Firecrawl results aren't geocoded
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
