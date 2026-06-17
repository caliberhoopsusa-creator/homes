// Per-deal activity timeline, derived from existing rows (no events table):
// deal creation, underwrite, buyer dispatches, assignment, and the contract.
import "server-only";
import {
  getBuyers,
  getContracts,
  getDeal,
  getMatchesForDeal,
  getUnderwriteForProperty,
} from "./data";

export interface ActivityEvent {
  at: string | null;
  label: string;
}

export async function getDealActivity(dealId: string): Promise<ActivityEvent[]> {
  const deal = await getDeal(dealId);
  if (!deal) return [];

  const [uw, matches, buyers, contracts] = await Promise.all([
    deal.property_id ? getUnderwriteForProperty(deal.property_id) : Promise.resolve(null),
    getMatchesForDeal(dealId),
    getBuyers(),
    getContracts(),
  ]);
  const nameOf = (id: string | null) => buyers.find((b) => b.id === id)?.name ?? "a buyer";

  const events: ActivityEvent[] = [{ at: deal.created_at, label: "Deal created" }];
  if (uw) {
    events.push({ at: uw.created_at, label: `Underwritten — verdict ${uw.verdict ?? "?"}` });
  }
  for (const m of matches) {
    if (m.sent_at) events.push({ at: m.sent_at, label: `Dispatched to ${nameOf(m.buyer_id)}` });
  }
  if (deal.assigned_buyer_id) {
    events.push({ at: null, label: `Assigned to ${nameOf(deal.assigned_buyer_id)}` });
  }
  for (const c of contracts) {
    if (c.property_id === deal.property_id) {
      events.push({ at: c.created_at, label: `Contract — ${c.status}` });
    }
  }

  // Chronological; undated events (e.g. assignment) sort to the end.
  return events.sort((a, b) => (a.at ?? "~").localeCompare(b.at ?? "~"));
}
