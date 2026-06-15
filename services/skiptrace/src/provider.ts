// The swappable skip-trace seam (§7.4). A provider resolves owner contact info
// for one property, returning a typed hit or null when no match is found.
import type { Property, OwnerHit } from "@parcel/types";

export interface SkipTraceProvider {
  /** Resolve owner contact info for a property, or null if no match. */
  trace(property: Property): Promise<OwnerHit | null>;
}
