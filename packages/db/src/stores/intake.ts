import type {
  ContractInsert,
  DealInsert,
  Owner,
  ReplyInsert,
  SuppressionReason,
} from "@parcel/types";
import type { IntakeStore, OwnerContext } from "@parcel/intake";
import type { Db } from "../client.js";
import { unwrap } from "../util.js";

/** Postgres-backed IntakeStore (PRD §6.5) — resolves context + persists the gate. */
export class IntakeDbStore implements IntakeStore {
  constructor(private readonly db: Db) {}

  async resolveContext(input: {
    fromEmail: string;
    inReplyTo: string | null;
  }): Promise<OwnerContext> {
    const owners = unwrap(
      await this.db.from("owners").select("*").eq("email", input.fromEmail).limit(1),
    ) as Owner[];
    const owner = owners[0] ?? null;

    // Prefer the exact message this is a reply to; fall back to the owner's
    // latest outbound touch.
    let messageId: string | null = null;
    if (input.inReplyTo) {
      const m = unwrap(
        await this.db.from("messages").select("id").eq("provider_id", input.inReplyTo).limit(1),
      ) as Array<{ id: string }>;
      messageId = m[0]?.id ?? null;
    }
    if (!messageId && owner) {
      const m = unwrap(
        await this.db
          .from("messages")
          .select("id")
          .eq("owner_id", owner.id)
          .eq("direction", "outbound")
          .order("created_at", { ascending: false })
          .limit(1),
      ) as Array<{ id: string }>;
      messageId = m[0]?.id ?? null;
    }

    const propertyId = owner?.property_id ?? null;
    let propertyAddress: string | null = null;
    let yourMao: number | null = null;
    if (propertyId) {
      const props = unwrap(
        await this.db.from("properties").select("address").eq("id", propertyId).limit(1),
      ) as Array<{ address: string }>;
      propertyAddress = props[0]?.address ?? null;
      const uw = unwrap(
        await this.db
          .from("underwrites")
          .select("your_mao")
          .eq("property_id", propertyId)
          .order("created_at", { ascending: false })
          .limit(1),
      ) as Array<{ your_mao: number | null }>;
      yourMao = uw[0]?.your_mao ?? null;
    }

    return {
      ownerId: owner?.id ?? null,
      messageId,
      propertyId,
      ownerName: owner?.full_name ?? null,
      propertyAddress,
      yourMao,
    };
  }

  async alreadyHandled(providerMessageId: string): Promise<boolean> {
    const rows = unwrap(
      await this.db
        .from("replies")
        .select("id")
        .eq("provider_id", providerMessageId)
        .limit(1),
    ) as Array<{ id: string }>;
    return rows.length > 0;
  }

  async insertReply(row: ReplyInsert): Promise<{ id: string }> {
    const data = unwrap(
      await this.db.from("replies").insert(row).select("id"),
    ) as Array<{ id: string }>;
    const id = data[0]?.id;
    if (!id) throw new Error("insertReply: no id returned");
    return { id };
  }

  async markMessageReplied(messageId: string): Promise<void> {
    unwrap(await this.db.from("messages").update({ status: "replied" }).eq("id", messageId));
  }

  async insertContract(row: ContractInsert): Promise<{ id: string }> {
    const data = unwrap(
      await this.db.from("contracts").insert(row).select("id"),
    ) as Array<{ id: string }>;
    const id = data[0]?.id;
    if (!id) throw new Error("insertContract: no id returned");
    return { id };
  }

  async insertDeal(row: DealInsert): Promise<{ id: string }> {
    const data = unwrap(
      await this.db.from("deals").insert(row).select("id"),
    ) as Array<{ id: string }>;
    const id = data[0]?.id;
    if (!id) throw new Error("insertDeal: no id returned");
    return { id };
  }

  async addSuppression(email: string, reason: SuppressionReason): Promise<void> {
    unwrap(
      await this.db.from("suppressions").upsert({ email, reason }, { onConflict: "email" }),
    );
  }
}
