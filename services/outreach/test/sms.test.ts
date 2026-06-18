import { describe, it, expect } from "vitest";
import {
  assertTextable,
  smsKeyword,
  makeSmsProvider,
  MockSmsProvider,
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
