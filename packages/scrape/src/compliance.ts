// COMPLIANCE — the single source of truth for what this engine may scrape.
//
// PRD §8.4 / CLAUDE.md make this non-negotiable: never scrape Zillow / Redfin /
// Trulia / Realtor (ToS + legal risk + the Montana unlicensed-broker line). This
// module centralizes the denylist (previously duplicated across the sourcing and
// skiptrace Firecrawl providers) and is enforced at the engine boundary, so no
// caller can bypass it.

/** Hosts we must never scrape, regardless of allowlist. */
export const DENY_DOMAINS = [
  "zillow.com",
  "redfin.com",
  "trulia.com",
  "realtor.com",
] as const;

/** Parse a URL's registrable-ish host, lowercased, without a leading www. */
function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

/** True if host equals `domain` or is a subdomain of it. */
function matches(host: string, domain: string): boolean {
  const d = domain.replace(/^www\./, "").toLowerCase();
  return host === d || host.endsWith(`.${d}`);
}

/** True if the URL is on the denylist (catches subdomain bypass attempts). */
export function isDenied(url: string): boolean {
  const host = hostOf(url);
  if (host === null) return true; // unparseable → treat as not permitted
  return DENY_DOMAINS.some((d) => matches(host, d));
}

/**
 * Whether a URL may be scraped.
 * - Always rejects denied domains and unparseable URLs.
 * - If `allow` is non-empty, the host must also be on that allowlist.
 */
export function isPermitted(url: string, allow: ReadonlyArray<string> = []): boolean {
  const host = hostOf(url);
  if (host === null) return false;
  if (DENY_DOMAINS.some((d) => matches(host, d))) return false;
  if (allow.length > 0) return allow.some((d) => matches(host, d));
  return true;
}

/** A denied-domain guard for engines: throw early on a forbidden URL. */
export function assertPermitted(url: string, allow: ReadonlyArray<string> = []): void {
  if (!isPermitted(url, allow)) {
    throw new Error(
      `Scrape refused: "${url}" is not a permitted source ` +
        `(denied domain or outside the configured allowlist). See PRD §8.4.`,
    );
  }
}

// ── robots.txt (minimal, conservative) ──────────────────────────────────────

/** Parsed robots directives for a single user-agent group. */
export interface RobotsRules {
  disallow: string[];
}

/**
 * Parse robots.txt, returning the rules that apply to our agent (we honor the
 * union of the `*` group and any group naming our token). Conservative: a parse
 * failure yields no rules (caller decides), and only `Disallow` is tracked.
 */
export function parseRobots(text: string, agent = "*"): RobotsRules {
  const lines = text.split(/\r?\n/);
  const disallow: string[] = [];
  let active = false;
  const want = agent.toLowerCase();

  for (const raw of lines) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (field === "user-agent") {
      const ua = value.toLowerCase();
      active = ua === "*" || ua === want;
    } else if (field === "disallow" && active) {
      if (value) disallow.push(value);
    }
  }
  return { disallow };
}

/** True if robots rules forbid fetching the given URL path. */
export function robotsAllows(rules: RobotsRules, url: string): boolean {
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return false;
  }
  return !rules.disallow.some((rule) => rule !== "" && path.startsWith(rule));
}
