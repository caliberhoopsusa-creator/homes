import { describe, it, expect } from "vitest";
import type { SmsConsent } from "@parcel/types";
import { normalizePhone, consentFromRows } from "../lib/sms-consent";

function row(over: Partial<SmsConsent> & Pick<SmsConsent, "id" | "created_at">): SmsConsent {
  return {
    phone: "4065550123",
    consented: true,
    source: "web_optin",
    owner_id: null,
    buyer_id: null,
    consented_at: over.created_at,
    revoked_at: null,
    ...over,
  };
}

describe("normalizePhone", () => {
  it("strips formatting to digits", () => {
    expect(normalizePhone("(406) 555-0123")).toBe("4065550123");
  });
  it("drops a leading US country code", () => {
    expect(normalizePhone("+1 406 555 0123")).toBe("4065550123");
    expect(normalizePhone("14065550123")).toBe("4065550123");
  });
});

describe("consentFromRows (latest event wins)", () => {
  it("no rows = no consent (cold texting blocked)", () => {
    expect(consentFromRows([])).toBe(false);
  });

  it("an active opt-in = consent", () => {
    expect(consentFromRows([row({ id: "a", created_at: "2026-06-18T10:00:00Z" })])).toBe(true);
  });

  it("a STOP after opt-in revokes consent", () => {
    const rows = [
      row({ id: "a", created_at: "2026-06-18T10:00:00Z", consented: true }),
      row({
        id: "b",
        created_at: "2026-06-18T11:00:00Z",
        consented: false,
        revoked_at: "2026-06-18T11:00:00Z",
        source: "STOP",
      }),
    ];
    expect(consentFromRows(rows)).toBe(false);
  });

  it("a re-opt-in after STOP restores consent (latest wins)", () => {
    const rows = [
      row({ id: "a", created_at: "2026-06-18T10:00:00Z" }),
      row({
        id: "b",
        created_at: "2026-06-18T11:00:00Z",
        consented: false,
        revoked_at: "2026-06-18T11:00:00Z",
        source: "STOP",
      }),
      row({ id: "c", created_at: "2026-06-18T12:00:00Z", consented: true }),
    ];
    expect(consentFromRows(rows)).toBe(true);
  });
});
