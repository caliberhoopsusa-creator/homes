// A tiny in-memory rate-limit + cache wrapper around any PropertyProvider.
// - Caches identical requests for a short TTL (provider responses are stable
//   within a pull window) to avoid burning API quota on retries.
// - Enforces a minimum gap between live upstream calls (simple rate limit).
import type { RadiusPullRequest, PropertyCandidate } from "@parcel/types";
import type { PropertyProvider } from "./provider.js";

export interface CacheOptions {
  /** Cache time-to-live in ms. Default 60s. */
  ttlMs?: number;
  /** Minimum gap between upstream (cache-miss) calls, in ms. Default 0. */
  minGapMs?: number;
  /** Clock injection for deterministic tests. Default Date.now. */
  now?: () => number;
  /** Sleep injection for deterministic tests. Default real setTimeout. */
  sleep?: (ms: number) => Promise<void>;
}

interface Entry {
  at: number;
  value: PropertyCandidate[];
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

export class CachingProvider implements PropertyProvider {
  private readonly inner: PropertyProvider;
  private readonly ttlMs: number;
  private readonly minGapMs: number;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly store = new Map<string, Entry>();
  private lastCallAt = -Infinity;

  constructor(inner: PropertyProvider, opts: CacheOptions = {}) {
    this.inner = inner;
    this.ttlMs = opts.ttlMs ?? 60_000;
    this.minGapMs = opts.minGapMs ?? 0;
    this.now = opts.now ?? Date.now;
    this.sleep = opts.sleep ?? defaultSleep;
  }

  async search(req: RadiusPullRequest): Promise<PropertyCandidate[]> {
    const key = keyOf(req);
    const hit = this.store.get(key);
    const t = this.now();
    if (hit && t - hit.at < this.ttlMs) return hit.value;

    // Rate limit: wait out the remaining gap since the last upstream call.
    if (this.minGapMs > 0) {
      const wait = this.minGapMs - (t - this.lastCallAt);
      if (wait > 0) await this.sleep(wait);
    }

    const value = await this.inner.search(req);
    this.lastCallAt = this.now();
    this.store.set(key, { at: this.lastCallAt, value });
    return value;
  }
}

function keyOf(req: RadiusPullRequest): string {
  return JSON.stringify({
    lat: req.lat,
    lng: req.lng,
    r: req.radiusMiles,
    f: req.filters ?? {},
  });
}
