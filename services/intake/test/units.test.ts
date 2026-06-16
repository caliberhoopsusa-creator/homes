import { describe, it, expect } from "vitest";
import { MockClassifier, parseIntentJson } from "../src/classifier.js";
import { renderContractPdf } from "../src/pdf.js";
import {
  fillAssignmentTemplate,
  ATTORNEY_REVIEW_NOTICE,
  templateReviewed,
} from "../src/template.js";
import { extractEmail, parseInReplyTo, parseInboundParse } from "../src/inbound.js";

const decode = (b: Uint8Array) => String.fromCharCode(...b);

describe("MockClassifier", () => {
  const c = new MockClassifier();
  it("reads a yes as interested", async () => {
    expect((await c.classify("Yes, what's your offer?")).intent).toBe("interested");
  });
  it("reads remove/stop as do_not_contact (checked before interested)", async () => {
    expect((await c.classify("please remove me from your list")).intent).toBe("do_not_contact");
    expect((await c.classify("STOP")).intent).toBe("do_not_contact");
  });
  it("does not misread 'not interested' as interested", async () => {
    expect((await c.classify("not interested, thanks")).intent).toBe("not_now");
  });
  it("falls back to unknown", async () => {
    const r = await c.classify("the weather is nice");
    expect(r.intent).toBe("unknown");
    expect(r.confidence).toBeLessThan(0.5);
  });
});

describe("parseIntentJson", () => {
  it("clamps to the enum and confidence range", () => {
    expect(parseIntentJson('{"intent":"interested","confidence":1.4}')).toEqual({
      intent: "interested",
      confidence: 1,
    });
    expect(parseIntentJson('{"intent":"banana","confidence":0.9}').intent).toBe("unknown");
    expect(parseIntentJson("no json here").intent).toBe("unknown");
  });
});

describe("renderContractPdf", () => {
  it("produces a valid PDF carrying the offer text", () => {
    const lines = fillAssignmentTemplate(
      {
        sellerName: "Jane Doe",
        buyerName: "Parcel Holdings LLC",
        propertyAddress: "123 Elm St, Billings, MT 59101",
        offerPrice: 158000,
      },
      {},
    );
    const pdf = renderContractPdf(lines);
    const s = decode(pdf);
    expect(s.startsWith("%PDF-1.4")).toBe(true);
    expect(s.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(s).toContain("123 Elm St");
    expect(s).toContain("$158,000");
    expect(s).toContain("xref");
  });
});

describe("assignment template", () => {
  it("stamps the attorney-review notice until reviewed", () => {
    const draft = fillAssignmentTemplate(
      { sellerName: "A", buyerName: "B", propertyAddress: "X", offerPrice: 1 },
      {},
    );
    expect(draft.join("\n")).toContain(ATTORNEY_REVIEW_NOTICE);

    const reviewed = fillAssignmentTemplate(
      { sellerName: "A", buyerName: "B", propertyAddress: "X", offerPrice: 1 },
      { CONTRACT_TEMPLATE_REVIEWED: "true" },
    );
    expect(reviewed.join("\n")).not.toContain(ATTORNEY_REVIEW_NOTICE);
    expect(templateReviewed({ CONTRACT_TEMPLATE_REVIEWED: "true" })).toBe(true);
  });
  it("frames it as an offer to buy, never a listing", () => {
    const t = fillAssignmentTemplate(
      { sellerName: "A", buyerName: "B", propertyAddress: "X", offerPrice: 1 },
      {},
    ).join("\n");
    expect(t).toContain("OFFER TO PURCHASE");
    expect(t).toContain("ASSIGNABLE");
  });
});

describe("inbound parsing", () => {
  it("extracts bare emails and In-Reply-To", () => {
    expect(extractEmail("Jane Doe <Jane@Example.COM>")).toBe("jane@example.com");
    expect(parseInReplyTo("From: x\r\nIn-Reply-To: <msg-123@sg>\r\n")).toBe("msg-123@sg");
  });
  it("normalizes a SendGrid Inbound Parse payload", () => {
    const e = parseInboundParse({
      from: "Owner <owner@host.com>",
      to: "replies@offers.brand.com",
      subject: "Re: your offer",
      text: "  yes please  ",
      headers: "In-Reply-To: <m-9@sg>",
    });
    expect(e.fromEmail).toBe("owner@host.com");
    expect(e.text).toBe("yes please");
    expect(e.inReplyTo).toBe("m-9@sg");
  });
});
