import { describe, it, expect } from "vitest";
import type { Owner, Property } from "@parcel/types";
import {
  complianceFooter,
  isCompliant,
  unsubscribeToken,
  unsubscribeUrl,
} from "../src/compliance.js";
import { SEQUENCE, buildMessage, realTokens, stepTemplate } from "../src/sequence.js";
import {
  MockPersonalizer,
  AnthropicPersonalizer,
  makePersonalizer,
} from "../src/personalizer.js";
import { MockProvider, SendGridProvider, makeProvider } from "../src/provider.js";
import { configFromEnv } from "../src/config.js";
import type { FetchLike, FetchResponse } from "../src/env.js";

const CFG = configFromEnv({
  MAILING_ADDRESS: "Addr, MT",
  UNSUBSCRIBE_BASE_URL: "https://u.test/x",
});

function prop(p: Partial<Property> = {}): Property {
  return {
    id: "p",
    source: "manual",
    source_id: null,
    address: "9 Elm Ave",
    city: "Bozeman",
    state: "MT",
    zip: "59715",
    lat: null,
    lng: null,
    beds: null,
    baths: null,
    sqft: null,
    year_built: null,
    est_value: null,
    asking: null,
    distress_signals: null,
    created_at: "2026-01-01T00:00:00Z",
    ...p,
  };
}
function owner(o: Partial<Owner> = {}): Owner {
  return {
    id: "ow1",
    property_id: "p",
    full_name: null,
    email: "x@y.com",
    phone: null,
    mailing_address: null,
    skiptrace_status: "matched",
    skiptrace_confidence: null,
    created_at: "2026-01-01T00:00:00Z",
    ...o,
  };
}

describe("sequence", () => {
  it("has exactly 6 touches at day 0 / 3 / 7 / 14 / 21 / 30", () => {
    expect(SEQUENCE.map((s) => s.step)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(SEQUENCE.map((s) => s.dayOffset)).toEqual([0, 3, 7, 14, 21, 30]);
  });

  it("touch 1 is plain-text only (no links/images in template body)", () => {
    const t1 = stepTemplate(1);
    expect(t1.plainTextOnly).toBe(true);
    expect(t1.body).not.toMatch(/https?:\/\//);
    expect(t1.body).not.toMatch(/<img|!\[/);
  });

  it("every template has exactly one CTA question and never says 'for sale'", () => {
    for (const s of SEQUENCE) {
      const questions = (s.body.match(/\?/g) ?? []).length;
      expect(questions).toBeLessThanOrEqual(1);
      expect(`${s.subject}\n${s.body}`.toLowerCase()).not.toContain("for sale");
    }
  });

  it("realTokens only emits address + neighborhood, never invented data", () => {
    const t = realTokens(prop());
    expect(Object.keys(t).sort()).toEqual(["address", "neighborhood"]);
    expect(t.address).toBe("9 Elm Ave");
    expect(t.neighborhood).toBe("Bozeman");
  });

  it("falls back neighborhood to zip then generic when city missing", () => {
    expect(realTokens(prop({ city: null })).neighborhood).toBe("59715");
    expect(realTokens(prop({ city: null, zip: null })).neighborhood).toBe("your area");
  });

  it("buildMessage substitutes tokens and appends the compliance footer", () => {
    const p = new MockPersonalizer();
    const m = buildMessage({
      owner: owner({ id: "ow9" }),
      property: prop(),
      step: 1,
      cfg: CFG,
      fill: p.fill.bind(p),
    });
    expect(m.subject).toContain("9 Elm Ave");
    expect(m.body).toContain("9 Elm Ave");
    expect(m.body).toContain("Bozeman");
    expect(isCompliant(m.body, "ow9", CFG)).toBe(true);
  });

  it("stepTemplate throws on an unknown step", () => {
    expect(() => stepTemplate(7)).toThrow();
  });
});

describe("compliance", () => {
  it("token is per-owner, opaque, and URL-safe", () => {
    const a = unsubscribeToken("owner-a");
    const b = unsubscribeToken("owner-b");
    expect(a).not.toBe(b);
    expect(a).not.toMatch(/[+/=]/);
  });

  it("footer carries mailing address + working unsubscribe URL with token", () => {
    const f = complianceFooter("ow1", CFG);
    expect(f).toContain("Addr, MT");
    expect(f).toContain(unsubscribeUrl("ow1", CFG));
    expect(f).toContain(unsubscribeToken("ow1"));
  });

  it("isCompliant fails when address or token is absent", () => {
    expect(isCompliant("hello world", "ow1", CFG)).toBe(false);
  });
});

describe("personalizer factory + impls", () => {
  it("MockPersonalizer leaves unknown tokens literal", () => {
    const p = new MockPersonalizer();
    expect(p.fill("hi {{address}} {{nope}}", { address: "1 A St" })).toBe(
      "hi 1 A St {{nope}}",
    );
  });

  it("defaults to mock; selects anthropic via env", () => {
    expect(makePersonalizer({})).toBeInstanceOf(MockPersonalizer);
    expect(() =>
      makePersonalizer({ PERSONALIZER: "anthropic" }),
    ).toThrow(/ANTHROPIC_API_KEY/);
  });

  it("AnthropicPersonalizer throws without a key, uses default model with one", () => {
    expect(() => new AnthropicPersonalizer({})).toThrow(/ANTHROPIC_API_KEY/);
    const p = new AnthropicPersonalizer({ apiKey: "sk-test" });
    expect(p.fill("hi {{address}}", { address: "X" })).toBe("hi X");
  });
});

describe("provider factory + impls", () => {
  it("MockProvider records sends and returns sent status", async () => {
    const mp = new MockProvider();
    const r = await mp.send({
      to: "a@b.com",
      from: "f@p.com",
      fromName: "P",
      replyTo: "r@p.com",
      subject: "s",
      body: "b",
    });
    expect(r.status).toBe("sent");
    expect(r.providerId).toMatch(/^mock-/);
    expect(mp.sent).toHaveLength(1);
  });

  it("defaults to mock; selects sendgrid via env", () => {
    expect(makeProvider({})).toBeInstanceOf(MockProvider);
    expect(() =>
      makeProvider({ EMAIL_PROVIDER: "sendgrid" }),
    ).toThrow(/SENDGRID_API_KEY/);
  });

  it("SendGridProvider throws without a key", () => {
    expect(() => new SendGridProvider({})).toThrow(/SENDGRID_API_KEY/);
  });

  it("SendGridProvider maps to a faithful v3 payload and returns provider id", async () => {
    let captured: { url: string; body: any } | null = null;
    const fakeFetch: FetchLike = async (url, init) => {
      const body = JSON.parse((init as { body: string }).body);
      captured = { url, body };
      const res: FetchResponse = {
        ok: true,
        status: 202,
        headers: { get: (k: string) => (k === "x-message-id" ? "sg-123" : null) },
        json: async () => ({}),
      };
      return res;
    };

    const sg = new SendGridProvider({
      apiKey: "sk-test",
      fromEmail: "offers@buy.test",
      replyTo: "reply@buy.test",
      fetchImpl: fakeFetch,
    });
    const r = await sg.send({
      to: "owner@x.com",
      from: "ignored@x.com",
      fromName: "Parcel",
      replyTo: "ignored@x.com",
      subject: "Quick question",
      body: "body text",
    });

    expect(r).toEqual({ providerId: "sg-123", status: "sent" });
    expect(captured!.url).toBe("https://api.sendgrid.com/v3/mail/send");
    expect(captured!.body.personalizations[0].to[0].email).toBe("owner@x.com");
    expect(captured!.body.from.email).toBe("offers@buy.test");
    expect(captured!.body.reply_to.email).toBe("reply@buy.test");
    expect(captured!.body.content[0].type).toBe("text/plain");
  });
});
