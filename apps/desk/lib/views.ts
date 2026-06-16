// View-model assembly shared by pages. Joins deals → property + underwrite so
// pages don't re-stitch the same data. Reads through the data abstraction.
import "server-only";
import type { Buyer, Contract, Deal, Property, Underwrite } from "@parcel/types";
import {
  getBuyers,
  getContracts,
  getDeals,
  getProperties,
  getUnderwriteForProperty,
} from "./data";

export interface DealView {
  deal: Deal;
  property: Property | null;
  underwrite: Underwrite | null;
  /** The buyer this deal was assigned to, if any (the disposition winner). */
  assignedBuyer: Buyer | null;
  /** The latest contract for this deal's property, if any. */
  contract: Contract | null;
}

export async function getDealViews(): Promise<DealView[]> {
  const [deals, properties, buyers, contracts] = await Promise.all([
    getDeals(),
    getProperties(),
    getBuyers(),
    getContracts(),
  ]);
  const propById = new Map(properties.map((p) => [p.id, p]));
  const buyerById = new Map(buyers.map((b) => [b.id, b]));
  // Latest contract per property (the deal's current contract).
  const contractByProp = new Map<string, Contract>();
  for (const c of contracts) {
    if (!c.property_id) continue;
    const ex = contractByProp.get(c.property_id);
    if (!ex || c.created_at > ex.created_at) contractByProp.set(c.property_id, c);
  }

  return Promise.all(
    deals.map(async (deal) => {
      const property = deal.property_id ? propById.get(deal.property_id) ?? null : null;
      const underwrite = deal.property_id
        ? await getUnderwriteForProperty(deal.property_id)
        : null;
      const assignedBuyer = deal.assigned_buyer_id
        ? buyerById.get(deal.assigned_buyer_id) ?? null
        : null;
      const contract = deal.property_id
        ? contractByProp.get(deal.property_id) ?? null
        : null;
      return { deal, property, underwrite, assignedBuyer, contract };
    }),
  );
}
