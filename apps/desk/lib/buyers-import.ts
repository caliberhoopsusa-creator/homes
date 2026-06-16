// Build the cash-buyer list (the defensible asset) from public county cash-closing
// records: deeds with NO mortgage lien in the last ~6 months = provably active cash
// buyers (research: docs/RESEARCH-wholesaling.md §7). Pure inference — groups a
// buyer's purchases into one buy-box (areas, price band, min beds) the desk can match
// against. An ETL (per county) produces the CashSaleRecord[]; this turns them into buyers.
import type { BuyerInsert } from "@parcel/types";

/** A normalized public cash-purchase record (one closing). */
export interface CashSaleRecord {
  buyer_name: string;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  /** Sale price of this purchase. */
  price?: number | null;
  beds?: number | null;
}

const clean = (s: string | null | undefined) => (s ?? "").trim();

/**
 * Group cash-sale records by buyer and infer a buy-box for each:
 * - areas: the distinct cities (fallback zips) they've bought in
 * - min/max price: the range of their observed purchase prices
 * - min_beds: the smallest bed count they've bought (a floor for matching)
 * Buyers with no usable name are skipped.
 */
export function inferBuyersFromCashSales(records: CashSaleRecord[]): BuyerInsert[] {
  const groups = new Map<string, CashSaleRecord[]>();
  for (const r of records) {
    const name = clean(r.buyer_name);
    if (!name) continue;
    const key = name.toLowerCase();
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(r);
  }

  const buyers: BuyerInsert[] = [];
  for (const recs of groups.values()) {
    const name = clean(recs[0]!.buyer_name);
    const areas = [
      ...new Set(
        recs
          .map((r) => clean(r.city) || clean(r.zip))
          .filter((a) => a.length > 0),
      ),
    ];
    const prices = recs
      .map((r) => r.price)
      .filter((p): p is number => typeof p === "number" && p > 0);
    const beds = recs
      .map((r) => r.beds)
      .filter((b): b is number => typeof b === "number" && b > 0);

    buyers.push({
      name,
      type: "cash buyer",
      min_price: prices.length ? Math.min(...prices) : null,
      max_price: prices.length ? Math.max(...prices) : null,
      min_beds: beds.length ? Math.min(...beds) : null,
      areas: areas.length ? areas : null,
      max_repairs: null, // unknown from a deed record
      notes: `Inferred from ${recs.length} county cash purchase${recs.length === 1 ? "" : "s"}.`,
    });
  }
  return buyers;
}
