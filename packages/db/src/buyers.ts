import type { BuyerInsert } from "@parcel/types";
import type { Db } from "./client.js";
import { unwrap } from "./util.js";

/** Insert buyer-box rows (e.g. from the cash-closings importer). Returns the count written. */
export async function insertBuyers(db: Db, rows: BuyerInsert[]): Promise<number> {
  if (rows.length === 0) return 0;
  const data = unwrap(
    await db.from("buyers").insert(rows).select("id"),
  ) as Array<{ id: string }>;
  return data.length;
}
