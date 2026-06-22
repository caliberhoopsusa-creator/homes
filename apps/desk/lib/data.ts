// The single data abstraction every page reads/writes through. It picks
// Supabase when env is configured, else mutates in-memory fixtures — so the
// desk runs with zero setup and swapping to live is a one-flag change
// (just set NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY).
import "server-only";
import type {
  Buyer,
  BuyerInsert,
  ClosingTask,
  ClosingTaskStatus,
  Contract,
  ContractStatus,
  Deal,
  DealStage,
  Match,
  Message,
  Owner,
  Property,
  Reply,
  SmsConsent,
  Underwrite,
} from "@parcel/types";
import { closingSeedRows } from "./closing";
import { consentFromRows, normalizePhone } from "./sms-consent";
import { underwrite } from "@parcel/underwriting";
import { fetchAll } from "@parcel/db";
import { makeProvider, configFromEnv } from "@parcel/outreach";
import { getSupabase, isLive } from "./supabase";
import { computeMatchRows } from "./match";
import { nextContractStatus, dealStageForContractStatus } from "./lifecycle";
import { buildBuyerDispoEmail } from "./buyer-dispatch";
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
  closingTasks: [] as ClosingTask[],
  smsConsents: [] as SmsConsent[],
  suppressions: [] as string[],
  messages: [] as Message[],
  replies: [] as Reply[],
};

const newId = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

// ── reads ────────────────────────────────────────────────────────────────
export async function getProperties(): Promise<Property[]> {
  const sb = getSupabase();
  if (!sb) return mem.properties;
  // Page past PostgREST's 1000-row cap so all leads show (not just the first 1000).
  return fetchAll<Property>(() => sb.from("properties").select("*"));
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

export async function getOwners(): Promise<Owner[]> {
  const sb = getSupabase();
  if (!sb) return mem.owners;
  return fetchAll<Owner>(() => sb.from("owners").select("*"));
}

export async function getUnderwrites(): Promise<Underwrite[]> {
  const sb = getSupabase();
  if (!sb) return mem.underwrites;
  return fetchAll<Underwrite>(() => sb.from("underwrites").select("*"));
}

export async function getMessages(): Promise<Message[]> {
  const sb = getSupabase();
  if (!sb) return mem.messages;
  const { data } = await sb.from("messages").select("*");
  return (data as Message[]) ?? [];
}

export async function getReplies(): Promise<Reply[]> {
  const sb = getSupabase();
  if (!sb) return mem.replies;
  const { data } = await sb.from("replies").select("*");
  return (data as Reply[]) ?? [];
}

/** Promote a sourced property into the deal pipeline (idempotent). Returns the deal id. */
export async function createDealForProperty(
  propertyId: string,
): Promise<{ id: string }> {
  const sb = getSupabase();
  if (!sb) {
    const existing = mem.deals.find((d) => d.property_id === propertyId);
    if (existing) return { id: existing.id };
    const id = newId("deal");
    mem.deals.push({
      id,
      property_id: propertyId,
      stage: "Lead",
      assigned_buyer_id: null,
      notes: null,
      title_company: null,
      closing_date: null,
      created_at: new Date().toISOString(),
    });
    return { id };
  }
  const { data: found } = await sb
    .from("deals")
    .select("id")
    .eq("property_id", propertyId)
    .limit(1);
  const prior = ((found as { id: string }[]) ?? [])[0];
  if (prior) return { id: prior.id };
  const { data } = await sb
    .from("deals")
    .insert({ property_id: propertyId, stage: "Lead" })
    .select("id")
    .single();
  return { id: (data as { id: string }).id };
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
  // Let Postgres generate the uuid PK (the local newId() is for fixtures only and
  // is NOT a valid uuid). Surface insert errors instead of silently dropping rows.
  const { id: _localId, ...insertRow } = row;
  const { data, error } = await sb.from("buyers").insert(insertRow).select().single();
  if (error) throw new Error(`createBuyer: ${error.message}`);
  return data as Buyer;
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

/** True if an email is on the permanent suppression list (CAN-SPAM). */
export async function isEmailSuppressed(email: string): Promise<boolean> {
  const e = email.trim().toLowerCase();
  const sb = getSupabase();
  if (!sb) return mem.suppressions.includes(e);
  const { data } = await sb
    .from("suppressions")
    .select("email")
    .eq("email", e)
    .limit(1);
  return (((data as { email: string }[]) ?? []).length) > 0;
}

/** Permanently suppress an email (opt-out). Idempotent. Honors CAN-SPAM opt-outs. */
export async function suppressEmailAddress(
  email: string,
  reason = "unsubscribe",
): Promise<void> {
  const e = email.trim().toLowerCase();
  if (!e) return;
  const sb = getSupabase();
  if (!sb) {
    if (!mem.suppressions.includes(e)) mem.suppressions.push(e);
    return;
  }
  await sb.from("suppressions").upsert({ email: e, reason }, { onConflict: "email" });
}

// Send the compliant buyer-disposition email to each target buyer (mock provider
// until SendGrid). Suppression is a HARD gate; the deal-package link points the
// buyer at the full CMA. The deal's numbers come from the canonical underwrite().
async function sendDispoEmails(dealId: string, buyerIds: string[]): Promise<void> {
  const deal = await getDeal(dealId);
  if (!deal?.property_id) return;
  const [property, uw, buyers] = await Promise.all([
    getProperty(deal.property_id),
    getUnderwriteForProperty(deal.property_id),
    getBuyers(),
  ]);
  if (!property) return;

  const live = underwrite({
    arv: uw?.arv ?? property.est_value ?? 0,
    repairs: uw?.repairs ?? 0,
    asking: property.asking ?? 0,
    rulePct: uw?.rule_pct,
    feeTarget: uw?.fee_target,
  });

  const cfg = configFromEnv();
  const provider = makeProvider();
  const base = process.env.APP_BASE_URL ?? "http://localhost:3000";
  const packageUrl = `${base}/api/deals/${dealId}/package`;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL ?? cfg.replyTo;

  const targets = buyers.filter((b) => buyerIds.includes(b.id) && b.email);
  for (const b of targets) {
    const email = b.email!.trim();
    if (!email || (await isEmailSuppressed(email))) continue;
    const { subject, body } = buildBuyerDispoEmail({
      buyerName: b.name,
      address: property.address,
      city: property.city,
      beds: property.beds,
      baths: property.baths,
      sqft: property.sqft,
      arv: live.arv,
      repairs: live.repairs,
      buyerCeiling: live.buyerCeiling,
      packageUrl,
      mailingAddress: cfg.mailingAddress,
    });
    await provider.send({
      to: email,
      from: fromEmail,
      fromName: cfg.fromName,
      replyTo: cfg.replyTo,
      subject,
      body,
    });
  }
}

// Disposition dispatch: send a deal to its exclusive (top-N qualifying) or blast
// tier — emails the buyers a compliant deal alert (suppression-gated) AND records
// matches.sent_at. Returns the count dispatched.
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

  // Email the buyers (CAN-SPAM-compliant, suppression-checked) before recording.
  await sendDispoEmails(dealId, ids);

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

// ── closing coordinator ────────────────────────────────────────────────────
export async function getClosingTasks(dealId: string): Promise<ClosingTask[]> {
  const sb = getSupabase();
  if (!sb) {
    return mem.closingTasks
      .filter((t) => t.deal_id === dealId)
      .sort((a, b) => a.sort - b.sort);
  }
  const { data } = await sb
    .from("closing_tasks")
    .select("*")
    .eq("deal_id", dealId)
    .order("sort", { ascending: true });
  return (data as ClosingTask[]) ?? [];
}

/** Seed the 5-phase checklist for a deal (idempotent — no-op if tasks exist). */
export async function seedClosingTasks(dealId: string): Promise<number> {
  const existing = await getClosingTasks(dealId);
  if (existing.length > 0) return 0;
  const rows = closingSeedRows(dealId);

  const sb = getSupabase();
  if (!sb) {
    const now = new Date().toISOString();
    for (const r of rows) {
      mem.closingTasks.push({
        id: newId("ct"),
        deal_id: r.deal_id,
        phase: r.phase,
        label: r.label,
        status: "pending",
        sort: r.sort,
        due_at: null,
        done_at: null,
        created_at: now,
      });
    }
    return rows.length;
  }
  await sb.from("closing_tasks").insert(rows);
  return rows.length;
}

export async function setClosingTaskStatus(
  id: string,
  status: ClosingTaskStatus,
): Promise<void> {
  const doneAt = status === "done" ? new Date().toISOString() : null;
  const sb = getSupabase();
  if (!sb) {
    const t = mem.closingTasks.find((x) => x.id === id);
    if (t) {
      t.status = status;
      t.done_at = doneAt;
    }
    return;
  }
  await sb.from("closing_tasks").update({ status, done_at: doneAt }).eq("id", id);
}

/** Update a deal's closing-coordination fields (title company, closing date). */
export async function updateDealClosing(
  dealId: string,
  fields: { title_company?: string | null; closing_date?: string | null },
): Promise<void> {
  const sb = getSupabase();
  if (!sb) {
    const d = mem.deals.find((x) => x.id === dealId);
    if (d) Object.assign(d, fields);
    return;
  }
  await sb.from("deals").update(fields).eq("id", dealId);
}

// ── SMS consent (TCPA) ──────────────────────────────────────────────────────
async function consentRowsForPhone(phone: string): Promise<SmsConsent[]> {
  const norm = normalizePhone(phone);
  const sb = getSupabase();
  if (!sb) return mem.smsConsents.filter((c) => c.phone === norm);
  const { data } = await sb.from("sms_consents").select("*").eq("phone", norm);
  return (data as SmsConsent[]) ?? [];
}

/** True only if the contact has an active, non-revoked opt-in on file. */
export async function hasSmsConsent(phone: string): Promise<boolean> {
  return consentFromRows(await consentRowsForPhone(phone));
}

/** Record an opt-in (documented consent). */
export async function recordSmsConsent(input: {
  phone: string;
  source: string;
  ownerId?: string | null;
  buyerId?: string | null;
}): Promise<void> {
  const phone = normalizePhone(input.phone);
  const now = new Date().toISOString();
  const sb = getSupabase();
  if (!sb) {
    mem.smsConsents.push({
      id: newId("sms"),
      phone,
      consented: true,
      source: input.source,
      owner_id: input.ownerId ?? null,
      buyer_id: input.buyerId ?? null,
      consented_at: now,
      revoked_at: null,
      created_at: now,
    });
    return;
  }
  await sb.from("sms_consents").insert({
    phone,
    consented: true,
    source: input.source,
    owner_id: input.ownerId ?? null,
    buyer_id: input.buyerId ?? null,
  });
}

/** Honor a STOP: record an opt-out event that revokes consent for this phone. */
export async function revokeSmsConsent(phone: string, source = "STOP"): Promise<void> {
  const norm = normalizePhone(phone);
  const now = new Date().toISOString();
  const sb = getSupabase();
  if (!sb) {
    mem.smsConsents.push({
      id: newId("sms"),
      phone: norm,
      consented: false,
      source,
      owner_id: null,
      buyer_id: null,
      consented_at: null,
      revoked_at: now,
      created_at: now,
    });
    return;
  }
  await sb.from("sms_consents").insert({
    phone: norm,
    consented: false,
    source,
    revoked_at: now,
  });
}

export { isLive };
