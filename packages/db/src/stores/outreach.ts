import type { MessageInsert, MessageStatus, Owner, Property } from "@parcel/types";
import type {
  ClearingOwner,
  OutreachStore,
  OwnerTouchState,
} from "@parcel/outreach";
import type { Db } from "../client.js";
import { unwrap, fetchAll, startOfUtcDay } from "../util.js";

/** Postgres-backed OutreachStore (PRD §6.4). */
export class OutreachDbStore implements OutreachStore {
  constructor(private readonly db: Db) {}

  async clearingOwners(): Promise<ClearingOwner[]> {
    const clears = await fetchAll<{ property_id: string | null }>(() =>
      this.db.from("underwrites").select("property_id").eq("verdict", "clear"),
    );
    const ids = [
      ...new Set(clears.map((c) => c.property_id).filter((id): id is string => !!id)),
    ];
    if (ids.length === 0) return [];

    const props = unwrap(
      await this.db.from("properties").select("*").in("id", ids),
    ) as Property[];
    const owners = unwrap(
      await this.db
        .from("owners")
        .select("*")
        .in("property_id", ids)
        .eq("skiptrace_status", "matched"),
    ) as Owner[];

    const byProp = new Map(props.map((p) => [p.id, p]));
    const out: ClearingOwner[] = [];
    for (const owner of owners) {
      const property = owner.property_id ? byProp.get(owner.property_id) : undefined;
      if (property && owner.email) out.push({ owner, property });
    }
    return out;
  }

  async isSuppressed(email: string): Promise<boolean> {
    const rows = unwrap(
      await this.db.from("suppressions").select("id").eq("email", email).limit(1),
    ) as Array<{ id: string }>;
    return rows.length > 0;
  }

  async insertMessage(row: MessageInsert): Promise<{ id: string }> {
    const data = unwrap(
      await this.db.from("messages").insert(row).select("id"),
    ) as Array<{ id: string }>;
    const id = data[0]?.id;
    if (!id) throw new Error("insertMessage: no id returned");
    return { id };
  }

  async recordStatus(messageId: string, status: MessageStatus): Promise<void> {
    const patch: Record<string, unknown> = { status };
    if (status === "sent") patch.sent_at = new Date().toISOString();
    unwrap(await this.db.from("messages").update(patch).eq("id", messageId));
  }

  async sentTodayCount(campaignId: string): Promise<number> {
    const rows = unwrap(
      await this.db
        .from("messages")
        .select("id")
        .eq("campaign_id", campaignId)
        .gte("sent_at", startOfUtcDay()),
    ) as Array<{ id: string }>;
    return rows.length;
  }

  async outreachHistory(): Promise<Map<string, OwnerTouchState>> {
    // Sent seller-outreach touches; reduce to max step + latest send per owner.
    const rows = await fetchAll<{
      owner_id: string | null;
      step: number | null;
      sent_at: string | null;
    }>(() =>
      this.db
        .from("messages")
        .select("owner_id, step, sent_at")
        .eq("kind", "seller_outreach")
        .eq("direction", "outbound")
        .eq("status", "sent"),
    );

    const history = new Map<string, OwnerTouchState>();
    for (const r of rows) {
      if (!r.owner_id) continue;
      const step = r.step ?? 0;
      const prev = history.get(r.owner_id);
      if (!prev || step > prev.lastStep) {
        history.set(r.owner_id, { lastStep: step, lastSentAt: r.sent_at });
      }
    }
    return history;
  }
}
