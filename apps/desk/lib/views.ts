// View-model assembly shared by pages. Joins deals → property + underwrite so
// pages don't re-stitch the same data. Reads through the data abstraction.
import "server-only";
import type { Deal, Property, Underwrite } from "@parcel/types";
import {
  getDeals,
  getProperties,
  getUnderwriteForProperty,
} from "./data";

export interface DealView {
  deal: Deal;
  property: Property | null;
  underwrite: Underwrite | null;
}

export async function getDealViews(): Promise<DealView[]> {
  const [deals, properties] = await Promise.all([getDeals(), getProperties()]);
  const byId = new Map(properties.map((p) => [p.id, p]));

  return Promise.all(
    deals.map(async (deal) => {
      const property = deal.property_id ? byId.get(deal.property_id) ?? null : null;
      const underwrite = deal.property_id
        ? await getUnderwriteForProperty(deal.property_id)
        : null;
      return { deal, property, underwrite };
    }),
  );
}
