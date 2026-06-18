import type { DistressSignal, PropertyInsert, PropertySource } from "@parcel/types";
import type { AddressIndexRow, SourcingStore } from "@parcel/sourcing";
import type { Db } from "../client.js";
import { unwrap } from "../util.js";

/** Postgres-backed SourcingStore (PRD §6.1). */
export class SourcingDbStore implements SourcingStore {
  constructor(private readonly db: Db) {}

  async existingSourceIds(source: PropertySource): Promise<Set<string>> {
    const data = unwrap(
      await this.db.from("properties").select("source_id").eq("source", source),
    ) as Array<{ source_id: string | null }>;
    const set = new Set<string>();
    for (const r of data) if (r.source_id) set.add(r.source_id);
    return set;
  }

  async insertProperties(rows: PropertyInsert[]): Promise<number> {
    if (rows.length === 0) return 0;
    const data = unwrap(
      await this.db.from("properties").insert(rows).select("id"),
    ) as Array<{ id: string }>;
    return data.length;
  }

  async existingAddressIndex(): Promise<AddressIndexRow[]> {
    return unwrap(
      await this.db.from("properties").select("id, address, distress_signals"),
    ) as AddressIndexRow[];
  }

  async mergeDistress(id: string, signals: DistressSignal[]): Promise<void> {
    unwrap(
      await this.db.from("properties").update({ distress_signals: signals }).eq("id", id),
    );
  }
}
