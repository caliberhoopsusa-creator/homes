// The single data abstraction every page reads/writes through. It picks
// Supabase when env is configured, else mutates in-memory fixtures — so the
// desk runs with zero setup and swapping to live is a one-flag change
// (just set NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY).
import "server-only";
import type {
  Buyer,
  BuyerInsert,
  Contract,
  ContractStatus,
  Deal,
  DealStage,
  Match,
  Owner,
  Property,
  Underwrite,
} from "@parcel/types";
import { getSupabase, isLive } from "./supabase";
import { computeMatchRows } from "./match";
import { nextContractStatus, dealStageForContractStatus } from "./lifecycle";
import * as fx from "./fixtures";

// Mutable in-memory copies so fixture writes persist for the process lifetime.
const mem = {
  properties: [...fx.properties] as Property[],
  owners: [...fx.owners] as Owner[],
  underwrites: [...fx.underwrites] as Underwrite[],
  deals: fx.deals.map((d) => ({ ...d })) as Deal[],
  buyers: fx.buyers.map((b) => ({ ...b })) as Buyer[],
  matches: fx.matches.map((m) => ({ ...m })) as Match[],
  contracts: fx.contracts.map((c) => ({ ...c })) as Contract[],
};

const newId = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

// ── reads ────────────────────────────────────────────────────────────────
export async function getProperties(): Promise<Property[]> {
  const sb = getSupabase();
  if (!sb) return mem.properties;
  const { data } = await sb.from("properties").select("*");
  return (data as Property[]) ?? [];
}

export async function getProperty(id: string): Promise<Property | null> {
  const sb = getSupabase();
  if (!sb) return mem.properties.find((p) => p.id === id) ?? null;
  const { data } = await sb.from("properties").select("*").eq("id", id).single();
  return (data as Property) ?? null;
}

export async function getOwnerForProperty(
  propertyId: string,
): Promise<Owner | null> {
  const sb = getSupabase();
  if (!sb) return mem.owners.find((o) => o.property_id === propertyId) ?? null;
  const { data } = await sb
    .from("owners")
    .select("*")
    .eq("property_id", propertyId)
    .limit(1);
  return ((data as Owner[]) ?? [])[0] ?? null;
}

export async function getUnderwriteForProperty(
  propertyId: string,
): Promise<Underwrite | null> {
  const sb = getSupabase();
  if (!sb)
    return mem.underwrites.find((u) => u.property_id === propertyId) ?? null;
  const { data } = await sb
    .from("underwrites")
    .select("*")
    .eq("property_id", propertyId)
    .order("created_at", { ascending: false })
    .limit(1);
  return ((data as Underwrite[]) ?? [])[0] ?? null;
}

export async function getDeals(): Promise<Deal[]> {
  const sb = getSupabase();
  if (!sb) return mem.deals;
  const { data } = await sb.from("deals").select("*");
  return (data as Deal[]) ?? [];
}

export async function getDeal(id: string): Promise<Deal | null> {
  const sb = getSupabase();
  if (!sb) return mem.deals.find((d) => d.id === id) ?? null;
  const { data } = await sb.from("deals").select("*").eq("id", id).single();
  return (data as Deal) ?? null;
}

export async function getBuyers(): Promise<Buyer[]> {
  const sb = getSupabase();
  if (!sb) return mem.buyers;
  const { data } = await sb.from("buyers").select("*");
  return (data as Buyer[]) ?? [];
}

export async function getMatchesForDeal(dealId: string): Promise<Match[]> {
  const sb = getSupabase();
  if (!sb) return mem.matches.filter((m) => m.deal_id === dealId);
  const { data } = await sb.from("matches").select("*").eq("deal_id", dealId);
  return (data as Match[]) ?? [];
}

export async function getContracts(): Promise<Contract[]> {
  const sb = getSupabase();
  if (!sb) return mem.contracts;
  const { data } = await sb.from("contracts").select("*");
  return (data as Contract[]) ?? [];
}

export async function getContract(id: string): Promise<Contract | null> {
  const sb = getSupabase();
  if (!sb) return mem.contracts.find((c) => c.id === id) ?? null;
  const { data } = await sb.from("contracts").select("*").eq("id", id).single();
  return (data as Contract) ?? null;
}

// ── writes ───────────────────────────────────────────────────────────────
export async function setDealStage(
  id: string,
  stage: DealStage,
): Promise<void> {
  const sb = getSupabase();
  if (!sb) {
    const d = mem.deals.find((x) => x.id === id);
    if (d) d.stage = stage;
    return;
  }
  await sb.from("deals").update({ stage }).eq("id", id);
}

export async function createBuyer(input: BuyerInsert): Promise<Buyer> {
  const sb = getSupabase();
  const row: Buyer = {
    id: input.id ?? newId("buyer"),
    name: input.name ?? null,
    type: input.type ?? null,
    min_price: input.min_price ?? null,
    max_price: input.max_price ?? null,
    min_beds: input.min_beds ?? null,
    areas: input.areas ?? null,
    max_repairs: input.max_repairs ?? null,
    notes: input.notes ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    created_at: input.created_at ?? new Date().toISOString(),
  };
  if (!sb) {
    mem.buyers.push(row);
    return row;
  }
  const { data } = await sb.from("buyers").insert(row).select().single();
  return (data as Buyer) ?? row;
}

export async function updateBuyer(
  id: string,
  patch: Partial<BuyerInsert>,
): Promise<void> {
  const sb = getSupabase();
  if (!sb) {
    const b = mem.buyers.find((x) => x.id === id);
    if (b) Object.assign(b, patch);
    return;
  }
  await sb.from("buyers").update(patch).eq("id", id);
}

export async function deleteBuyer(id: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) {
    const i = mem.buyers.findIndex((x) => x.id === id);
    if (i >= 0) mem.buyers.splice(i, 1);
    return;
  }
  await sb.from("buyers").delete().eq("id", id);
}

// The human gate: queued -> approved -> sent -> signed. NEVER skips. As the
// contract advances, the deal's stage follows (sent -> Assigned, signed -> Closed).
export async function advanceContract(id: string): Promise<ContractStatus | null> {
  const sb = getSupabase();
  if (!sb) {
    const c = mem.contracts.find((x) => x.id === id);
    if (!c) return null;
    const next = nextContractStatus(c.status);
    if (!next) return c.status;
    c.status = next;
    const stage = dealStageForContractStatus(next);
    if (stage && c.property_id) {
      const d = mem.deals.find((x) => x.property_id === c.property_id);
      if (d) d.stage = stage;
    }
    return next;
  }
  const { data } = await sb
    .from("contracts")
    .select("status, property_id")
    .eq("id", id)
    .single();
  const cur = data as { status: ContractStatus; property_id: string | null } | null;
  if (!cur) return null;
  const next = nextContractStatus(cur.status);
  if (!next) return cur.status;
  await sb.from("contracts").update({ status: next }).eq("id", id);
  const stage = dealStageForContractStatus(next);
  if (stage && cur.property_id) {
    await sb.from("deals").update({ stage }).eq("property_id", cur.property_id);
  }
  return next;
}

// Recompute matchScore for every buyer against this deal and persist the snapshot
// to the `matches` table (was read-only before). Score is stored 0–100 (int column).
export async function upsertMatchesForDeal(dealId: string): Promise<void> {
  const deal = await getDeal(dealId);
  if (!deal?.property_id) return;
  const [property, uw, buyers] = await Promise.all([
    getProperty(deal.property_id),
    getUnderwriteForProperty(deal.property_id),
    getBuyers(),
  ]);
  if (!property) return;

  // Base rows (score/qualifies). sent_at is owned by dispatchToBuyers — never
  // clobber it here, so re-persisting a deal's matches keeps its dispatch state.
  const base = computeMatchRows(
    {
      property: { beds: property.beds, city: property.city, state: property.state },
      price: uw?.buyer_ceiling ?? 0,
      repairs: uw?.repairs ?? 0,
    },
    buyers,
  ).map((r) => ({
    deal_id: dealId,
    buyer_id: r.buyer_id,
    score: r.score,
    qualifies: r.qualifies,
  }));

  const sb = getSupabase();
  if (!sb) {
    const prior = new Map(
      mem.matches.filter((m) => m.deal_id === dealId).map((m) => [m.buyer_id, m.sent_at] as const),
    );
    mem.matches = mem.matches
      .filter((m) => m.deal_id !== dealId)
      .concat(base.map((b) => ({ ...b, sent_at: prior.get(b.buyer_id) ?? null })));
    return;
  }
  // Upsert only score/qualifies columns → sent_at is preserved by the DB.
  await sb.from("matches").upsert(base, { onConflict: "deal_id,buyer_id" });
}

/** Top-N qualifying buyers get the exclusive tier (matches buildDispoPlan's default). */
const DISPO_TOP_N = 5;

// Disposition dispatch: send a deal to its exclusive (top-N qualifying) or blast
// tier, recording matches.sent_at. (When live, this is where buyer emails would
// queue via the outreach engine; for now it records the dispatch.) Returns count.
export async function dispatchToBuyers(
  dealId: string,
  tier: "exclusive" | "blast",
): Promise<number> {
  await upsertMatchesForDeal(dealId);
  const qualifying = (await getMatchesForDeal(dealId))
    .filter((m) => m.qualifies)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const targets = tier === "exclusive"
    ? qualifying.slice(0, DISPO_TOP_N)
    : qualifying.slice(DISPO_TOP_N);
  const ids = targets.map((m) => m.buyer_id);
  if (ids.length === 0) return 0;

  const at = new Date().toISOString();
  const sb = getSupabase();
  if (!sb) {
    for (const m of mem.matches) {
      if (m.deal_id === dealId && ids.includes(m.buyer_id)) m.sent_at = at;
    }
    return ids.length;
  }
  await sb.from("matches").update({ sent_at: at }).eq("deal_id", dealId).in("buyer_id", ids);
  return ids.length;
}

// Assign a deal to a buyer: persist the match snapshot, advance the deal to
// "Under contract", and create a QUEUED contract for that buyer (offer = your_mao).
// The contract still needs the human Approve & send in the Contracts queue.
export async function assignDealToBuyer(
  dealId: string,
  buyerId: string,
): Promise<void> {
  const deal = await getDeal(dealId);
  if (!deal?.property_id) return;
  const [owner, uw] = await Promise.all([
    getOwnerForProperty(deal.property_id),
    getUnderwriteForProperty(deal.property_id),
  ]);
  await upsertMatchesForDeal(dealId);
  const offer = uw?.your_mao ?? null;

  const sb = getSupabase();
  if (!sb) {
    const d = mem.deals.find((x) => x.id === dealId);
    if (d) {
      d.assigned_buyer_id = buyerId;
      d.stage = "Under contract";
    }
    mem.contracts.push({
      id: newId("ctr"),
      property_id: deal.property_id,
      owner_id: owner?.id ?? null,
      buyer_id: buyerId,
      offer_price: offer,
      pdf_url: null,
      status: "queued",
      created_at: new Date().toISOString(),
    });
    return;
  }
  await sb
    .from("deals")
    .update({ assigned_buyer_id: buyerId, stage: "Under contract" })
    .eq("id", dealId);
  await sb.from("contracts").insert({
    property_id: deal.property_id,
    owner_id: owner?.id ?? null,
    buyer_id: buyerId,
    offer_price: offer,
    status: "queued",
  });
}

export { isLive };
