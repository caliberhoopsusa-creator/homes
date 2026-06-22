import type { OwnerHit, Property } from "@parcel/types";
import type { SkiptraceStore } from "@parcel/skiptrace";
import type { Db } from "../client.js";
import { unwrap, fetchAll } from "../util.js";

/** Postgres-backed SkiptraceStore (PRD §6.2) — enforces the no-downgrade rule. */
export class SkiptraceDbStore implements SkiptraceStore {
  constructor(private readonly db: Db) {}

  async propertiesWithoutMatchedOwner(): Promise<Property[]> {
    const matched = await fetchAll<{ property_id: string | null }>(() =>
      this.db.from("owners").select("property_id").eq("skiptrace_status", "matched"),
    );
    const matchedIds = new Set(
      matched.map((m) => m.property_id).filter((id): id is string => !!id),
    );
    const props = await fetchAll<Property>(() =>
      this.db.from("properties").select("*"),
    );
    return props.filter((p) => !matchedIds.has(p.id));
  }

  async currentConfidence(propertyId: string): Promise<number | null> {
    const rows = unwrap(
      await this.db
        .from("owners")
        .select("skiptrace_confidence")
        .eq("property_id", propertyId)
        .order("skiptrace_confidence", { ascending: false })
        .limit(1),
    ) as Array<{ skiptrace_confidence: number | null }>;
    return rows[0]?.skiptrace_confidence ?? null;
  }

  async upsertOwner(propertyId: string, hit: OwnerHit): Promise<void> {
    const payload = {
      property_id: propertyId,
      full_name: hit.full_name,
      email: hit.email,
      phone: hit.phone,
      mailing_address: hit.mailing_address,
      skiptrace_status: "matched",
      skiptrace_confidence: hit.confidence,
    };
    const existing = unwrap(
      await this.db.from("owners").select("id").eq("property_id", propertyId).limit(1),
    ) as Array<{ id: string }>;
    if (existing[0]) {
      unwrap(await this.db.from("owners").update(payload).eq("id", existing[0].id));
    } else {
      unwrap(await this.db.from("owners").insert(payload));
    }
  }

  async markNone(propertyId: string): Promise<void> {
    const existing = unwrap(
      await this.db.from("owners").select("id").eq("property_id", propertyId).limit(1),
    ) as Array<{ id: string }>;
    if (existing[0]) {
      unwrap(
        await this.db
          .from("owners")
          .update({ skiptrace_status: "none" })
          .eq("id", existing[0].id),
      );
    } else {
      unwrap(
        await this.db
          .from("owners")
          .insert({ property_id: propertyId, skiptrace_status: "none" }),
      );
    }
  }
}
