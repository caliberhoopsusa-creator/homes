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

/** A normalized public ownership record (one parcel + its owner). Source: county cadastral. */
export interface OwnerParcel {
  owner_name: string;
  owner_city?: string | null;
  owner_state?: string | null;
  /** City the property sits in (an area the owner holds/buys in). */
  property_city?: string | null;
  property_state?: string | null;
  /** Assessed/market value of the parcel (proxy for their price band). */
  value?: number | null;
}

export interface OwnershipInferOptions {
  /** Min parcels an owner must hold to count as an investor/buyer. Default 2. */
  minProperties?: number;
}

// Names that are clearly not individual/LLC investors (govt, banks/REO, HOA, etc.).
const NON_INVESTOR =
  /\b(city of|county|state of|u\.?s\.?a?|united states|federal|bureau|department|dept|district|school|university|church|cemetery|authority|housing|h\.?o\.?a\.?|home ?owners|bank|mortgage|n\.?a\.?|fannie ?mae|freddie ?mac|hud)\b/i;

function isInvestorName(name: string): boolean {
  return name.length > 1 && !NON_INVESTOR.test(name);
}

/**
 * Group parcels by owner; owners holding ≥ `minProperties` are investors/landlords =
 * candidate cash buyers. Infer a buy-box from what they hold: the areas (property
 * cities) and a price band from their parcel values. Mailing city/state goes in notes.
 * Govt/bank/HOA owners are skipped. (Research: docs/RESEARCH-wholesaling.md §7.)
 */
export function inferBuyersFromOwnership(
  parcels: OwnerParcel[],
  opts: OwnershipInferOptions = {},
): BuyerInsert[] {
  const minProperties = opts.minProperties ?? 2;
  const groups = new Map<string, OwnerParcel[]>();
  for (const p of parcels) {
    const name = clean(p.owner_name);
    if (!name || !isInvestorName(name)) continue;
    const key = name.toLowerCase();
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(p);
  }

  const buyers: BuyerInsert[] = [];
  for (const recs of groups.values()) {
    if (recs.length < minProperties) continue;
    const name = clean(recs[0]!.owner_name);
    const areas = [
      ...new Set(recs.map((r) => clean(r.property_city)).filter((a) => a.length > 0)),
    ];
    const values = recs
      .map((r) => r.value)
      .filter((v): v is number => typeof v === "number" && v > 0);
    const ownerCity = clean(recs[0]!.owner_city);
    const ownerState = clean(recs[0]!.owner_state);
    const mailing = ownerCity && ownerState ? `${ownerCity}, ${ownerState}` : ownerState || null;

    buyers.push({
      name,
      type: "investor",
      min_price: values.length ? Math.min(...values) : null,
      max_price: values.length ? Math.max(...values) : null,
      min_beds: null,
      areas: areas.length ? areas : null,
      max_repairs: null,
      notes: `Owns ${recs.length} properties${areas.length ? ` in ${areas.join(", ")}` : ""}${mailing ? `; mailing ${mailing}` : ""}.`,
    });
  }
  return buyers;
}
