// Deterministic mock skip-trace provider. Returns a matched hit for ~70% of
// inputs (so the ≥60% target is comfortably met), each match carrying an email.
// Determinism is keyed off the property id so results are stable across runs.
import type { Property, OwnerHit } from "@parcel/types";
import type { SkipTraceProvider } from "../provider.js";

export interface MockProviderOptions {
  /** Fraction of inputs that resolve to a match. Default 0.7. */
  matchRate?: number;
}

/** FNV-1a hash → a stable [0,1) value from a string key. */
function unitHash(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 4294967296;
}

const FIRST = ["Pat", "Dana", "Jordan", "Casey", "Riley", "Morgan", "Sam", "Lee"];
const LAST = ["Hauser", "Begay", "Iron", "Stout", "Crow", "Walsh", "Reno", "Voss"];

export class MockProvider implements SkipTraceProvider {
  private readonly matchRate: number;

  constructor(opts: MockProviderOptions = {}) {
    this.matchRate = opts.matchRate ?? 0.7;
  }

  async trace(property: Property): Promise<OwnerHit | null> {
    const seed = unitHash(`match:${property.id}`);
    if (seed >= this.matchRate) return null;

    const first = FIRST[Math.floor(unitHash(`f:${property.id}`) * FIRST.length)];
    const last = LAST[Math.floor(unitHash(`l:${property.id}`) * LAST.length)];
    const full_name = `${first} ${last}`;
    const handle = `${first}.${last}`.toLowerCase();

    // Confidence in a realistic 0.55–0.97 band, derived from the id.
    const confidence = 0.55 + unitHash(`c:${property.id}`) * 0.42;
    // ~85% of matches also carry a phone; all matches carry an email.
    const hasPhone = unitHash(`p:${property.id}`) < 0.85;

    return {
      full_name,
      email: `${handle}@example.com`,
      phone: hasPhone ? phoneFor(property.id) : null,
      mailing_address: property.address,
      confidence,
    };
  }
}

function phoneFor(id: string): string {
  const n = Math.floor(unitHash(`ph:${id}`) * 9_000_000) + 1_000_000;
  return `+1406${n}`;
}
