import type { Property, UnderwriteInsert } from "@parcel/types";
import type { UnderwriteStore } from "@parcel/underwriting";
import type { Db } from "../client.js";
import { unwrap, fetchAll } from "../util.js";

/** Postgres-backed UnderwriteStore (PRD §6.3). */
export class UnderwriteDbStore implements UnderwriteStore {
  constructor(private readonly db: Db) {}

  async propertiesNeedingUnderwrite(): Promise<Property[]> {
    const done = await fetchAll<{ property_id: string | null }>(() =>
      this.db.from("underwrites").select("property_id"),
    );
    const doneIds = new Set(
      done.map((u) => u.property_id).filter((id): id is string => !!id),
    );
    const props = await fetchAll<Property>(() =>
      this.db.from("properties").select("*"),
    );
    return props.filter((p) => !doneIds.has(p.id));
  }

  async insertUnderwrite(row: UnderwriteInsert): Promise<void> {
    unwrap(await this.db.from("underwrites").insert(row));
  }
}
