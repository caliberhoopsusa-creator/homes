// CAN-SPAM compliance helpers (CLAUDE.md non-negotiable #2, PRD §6.4 §8).
// Every outbound body MUST carry: a physical mailing address and a working
// one-click unsubscribe link bound to a per-owner token. These functions are
// pure so the test suite can assert the footer is present on every send.
import { createHmac, timingSafeEqual } from "node:crypto";
import type { OutreachConfig } from "./config.js";
import { ambientEnv } from "./env.js";

// HMAC-signed, per-owner unsubscribe token: `base64url(ownerId).base64url(HMAC)`.
// The signature makes the token UNFORGEABLE — without it, the token was just
// base64url(ownerId), so anyone could suppress an arbitrary owner by guessing an
// id. The secret comes from env (UNSUBSCRIBE_SECRET); set a strong value in
// production. The dev fallback is intentionally not secret.
function unsubSecret(): string {
  return ambientEnv().UNSUBSCRIBE_SECRET ?? "dev-unsubscribe-secret-change-me";
}

function signOwner(ownerId: string): string {
  return createHmac("sha256", unsubSecret()).update(ownerId).digest("base64url");
}

/** Signed, URL-safe per-owner unsubscribe token. */
export function unsubscribeToken(ownerId: string): string {
  const id = Buffer.from(ownerId, "utf8").toString("base64url");
  return `${id}.${signOwner(ownerId)}`;
}

/** Verify a token; return the ownerId it was issued for, or null if forged/invalid. */
export function verifyUnsubscribeToken(token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  let ownerId: string;
  try {
    ownerId = Buffer.from(token.slice(0, dot), "base64url").toString("utf8");
  } catch {
    return null;
  }
  const provided = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(signOwner(ownerId));
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null;
  }
  return ownerId;
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
