import type { SuppressionReason } from "@parcel/types";
import type { Db } from "./client.js";
import { unwrap } from "./util.js";

/**
 * Resolve an owner's email by id and add a permanent suppression (CAN-SPAM).
 * Used by the desk's one-click unsubscribe handler. Returns the suppressed email,
 * or null if the owner/email can't be found.
 */
export async function suppressOwnerById(
  db: Db,
  ownerId: string,
  reason: SuppressionReason,
): Promise<string | null> {
  const owners = unwrap(
    await db.from("owners").select("email").eq("id", ownerId).limit(1),
  ) as Array<{ email: string | null }>;
  const email = owners[0]?.email ?? null;
  if (!email) return null;
  unwrap(
    await db.from("suppressions").upsert({ email, reason }, { onConflict: "email" }),
  );
  return email;
}
