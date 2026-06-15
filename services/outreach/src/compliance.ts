// CAN-SPAM compliance helpers (CLAUDE.md non-negotiable #2, PRD §6.4 §8).
// Every outbound body MUST carry: a physical mailing address and a working
// one-click unsubscribe link bound to a per-owner token. These functions are
// pure so the test suite can assert the footer is present on every send.
import type { OutreachConfig } from "./config.js";
import { base64url } from "./env.js";

/**
 * Deterministic, opaque per-owner unsubscribe token. Real implementations would
 * use a signed/HMAC token; here we keep it dependency-free but per-owner unique
 * and URL-safe so the link is stable and honors opt-out for that specific owner.
 */
export function unsubscribeToken(ownerId: string): string {
  // base64url of the owner id keeps it opaque-ish and URL-safe without crypto deps.
  return base64url(`unsub:${ownerId}`);
}

/** Full one-click unsubscribe URL for an owner. */
export function unsubscribeUrl(ownerId: string, cfg: OutreachConfig): string {
  return `${cfg.unsubscribeBaseUrl}?t=${unsubscribeToken(ownerId)}`;
}

/**
 * The CAN-SPAM footer appended to every message body. Includes the physical
 * mailing address and a working one-click unsubscribe link.
 */
export function complianceFooter(ownerId: string, cfg: OutreachConfig): string {
  const url = unsubscribeUrl(ownerId, cfg);
  return [
    "—",
    `This is a one-time offer to purchase your property. We are not a real estate broker and your home is not listed for sale.`,
    `${cfg.mailingAddress}`,
    `Don't want these emails? Unsubscribe in one click: ${url}`,
  ].join("\n");
}

/** Attach the compliance footer to a body, guaranteeing it ends with the footer. */
export function withFooter(
  body: string,
  ownerId: string,
  cfg: OutreachConfig,
): string {
  return `${body.trimEnd()}\n\n${complianceFooter(ownerId, cfg)}\n`;
}

/**
 * Assertable invariant: a compliant body contains the mailing address and the
 * owner's unsubscribe token. Used defensively in runCampaign and in tests.
 */
export function isCompliant(
  body: string,
  ownerId: string,
  cfg: OutreachConfig,
): boolean {
  return (
    body.includes(cfg.mailingAddress) &&
    body.includes(unsubscribeToken(ownerId))
  );
}
