import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import {
  assertTextable,
  smsKeyword,
  makeSmsProvider,
  MockSmsProvider,
  validateTwilioSignature,
} from "../src/sms.js";

describe("assertTextable (TCPA gate)", () => {
  it("throws without consent (cold texting is impossible)", () => {
    expect(() => assertTextable({ hasConsent: false, suppressed: false })).toThrow(
      /consent/i,
    );
  });

  it("throws when the recipient opted out", () => {
    expect(() => assertTextable({ hasConsent: true, suppressed: true })).toThrow(
      /opted out|stop/i,
    );
  });

  it("passes only with consent and no suppression", () => {
    expect(() => assertTextable({ hasConsent: true, suppressed: false })).not.toThrow();
  });
});

describe("smsKeyword", () => {
  it("detects STOP variants", () => {
    for (const w of ["STOP", "stop", "unsubscribe", "Cancel", "quit"]) {
      expect(smsKeyword(w)).toBe("stop");
    }
  });
  it("detects HELP", () => {
    expect(smsKeyword("HELP")).toBe("help");
  });
  it("returns null for normal replies", () => {
    expect(smsKeyword("yeah I'd sell")).toBeNull();
  });
});

describe("validateTwilioSignature", () => {
  const authToken = "test-auth-token";
  const url = "https://desk.example/api/sms/inbound";
  const params = { From: "+14065550000", Body: "STOP" };
  const sign = (p: Record<string, string>) => {
    let data = url;
    for (const k of Object.keys(p).sort()) data += k + p[k];
    return createHmac("sha1", authToken).update(data, "utf8").digest("base64");
  };

  it("accepts a correctly-signed request", () => {
    expect(
      validateTwilioSignature({ authToken, url, params, signature: sign(params) }),
    ).toBe(true);
  });

  it("rejects a missing or tampered signature", () => {
    expect(validateTwilioSignature({ authToken, url, params, signature: null })).toBe(false);
    expect(validateTwilioSignature({ authToken, url, params, signature: "bogus" })).toBe(false);
  });

  it("rejects when params don't match the signature", () => {
    const sig = sign(params);
    expect(
      validateTwilioSignature({
        authToken,
        url,
        params: { ...params, Body: "tampered" },
        signature: sig,
      }),
    ).toBe(false);
  });
});

describe("makeSmsProvider", () => {
  it("is off (null) by default", () => {
    expect(makeSmsProvider({})).toBeNull();
  });
  it("returns the mock when SMS_PROVIDER=mock", () => {
    expect(makeSmsProvider({ SMS_PROVIDER: "mock" })).toBeInstanceOf(MockSmsProvider);
  });
  it("throws for twilio without credentials", () => {
    expect(() => makeSmsProvider({ SMS_PROVIDER: "twilio" })).toThrow(/TWILIO/);
  });
});
