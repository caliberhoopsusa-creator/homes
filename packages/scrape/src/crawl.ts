// Pure crawl helpers — link discovery + frontier selection. The self-hosted
// engine does the fetching; this module decides *what* to fetch next, so the
// BFS logic stays deterministic and unit-testable.
import { isPermitted } from "./compliance.js";

/** Extract absolute, http(s) hrefs from an HTML page, resolved against base. */
export function extractLinks(html: string, baseUrl: string): string[] {
  const out = new Set<string>();
  const re = /<a\b[^>]*href=["']([^"'#]+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const href = m[1];
    if (!href) continue;
    try {
      const resolved = new URL(href, baseUrl);
      if (resolved.protocol === "http:" || resolved.protocol === "https:") {
        resolved.hash = "";
        out.add(resolved.toString());
      }
    } catch {
      /* skip unparseable hrefs */
    }
  }
  return [...out];
}

/** True if `url` is on the same registrable host as `seed`. */
export function sameHost(url: string, seed: string): boolean {
  try {
    const a = new URL(url).hostname.replace(/^www\./, "");
    const b = new URL(seed).hostname.replace(/^www\./, "");
    return a === b;
  } catch {
    return false;
  }
}

/**
 * Filter freshly-discovered links down to the ones worth queueing: permitted,
 * same-host as the seed, and not already visited/queued.
 */
export function nextFrontier(
  discovered: string[],
  seed: string,
  seen: ReadonlySet<string>,
  allow: ReadonlyArray<string> = [],
): string[] {
  const out: string[] = [];
  for (const url of discovered) {
    if (seen.has(url)) continue;
    if (!sameHost(url, seed)) continue;
    if (!isPermitted(url, allow)) continue;
    out.push(url);
  }
  return out;
}
