// Pure SMS-consent helpers (no I/O). Latest event per phone wins, so a later
// opt-in can restore consent and a STOP permanently blocks until they re-opt-in.
import type { SmsConsent } from "@parcel/types";

/** Digits-only, US country-code-stripped, for stable matching. */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

/**
 * Decide consent from a phone's event rows: the most recent event wins. Returns
 * true only when the latest row is an active (non-revoked) opt-in.
 */
export function consentFromRows(rows: readonly SmsConsent[]): boolean {
  if (rows.length === 0) return false;
  const latest = [...rows].sort((a, b) => (a.created_at > b.created_at ? -1 : 1))[0];
  return !!latest && latest.consented && latest.revoked_at == null;
}
