// The swappable provider seam (§7.4): real integrations sit behind this named
// interface so they are mockable and opt-in. A provider turns a radius request
// into raw candidates; normalization/validation happens in the runner.
import type { RadiusPullRequest, PropertyCandidate } from "@parcel/types";

export interface PropertyProvider {
  /** Fetch candidate properties for a center+radius+filters request. */
  search(req: RadiusPullRequest): Promise<PropertyCandidate[]>;
}
