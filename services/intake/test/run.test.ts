import { describe, it, expect, beforeEach } from "vitest";
import type {
  ContractInsert,
  DealInsert,
  ReplyInsert,
  SuppressionReason,
} from "@parcel/types";
import { MockClassifier } from "../src/classifier.js";
import { MockStorage } from "../src/storage.js";
import {
  handleInboundReply,
  type IntakeStore,
  type OwnerContext,
} from "../src/run.js";
import { parseInboundParse, type InboundEmail } from "../src/inbound.js";

// A fake store that records everything and returns a fixed warm-lead context.
class FakeStore implements IntakeStore {
  replies: ReplyInsert[] = [];
  contracts: ContractInsert[] = [];
  deals: DealInsert[] = [];
  suppressions: Array<{ email: string; reason: SuppressionReason }> = [];
  repliedMessages: string[] = [];
  private seq = 0;

  constructor(private ctx: OwnerContext) {}

  async resolveContext() {
    return this.ctx;
  }
  async insertReply(row: ReplyInsert) {
    this.replies.push(row);
    return { id: `reply-${++this.seq}` };
  }
  async alreadyHandled(providerMessageId: string) {
    return this.replies.some((r) => r.provider_id === providerMessageId);
  }
  async markMessageReplied(id: string) {
    this.repliedMessages.push(id);
  }
  async insertContract(row: ContractInsert) {
    this.contracts.push(row);
    return { id: `contract-${++this.seq}` };
  }
  async insertDeal(row: DealInsert) {
    this.deals.push(row);
    return { id: `deal-${++this.seq}` };
  }
  async addSuppression(email: string, reason: SuppressionReason) {
    this.suppressions.push({ email, reason });
  }
}

const warmCtx: OwnerContext = {
  ownerId: "owner-1",
  messageId: "msg-1",
  propertyId: "prop-1",
  ownerName: "Jane Doe",
  propertyAddress: "123 Elm St, Billings, MT 59101",
  yourMao: 158000,
};

function deps(store: IntakeStore, storage = new MockStorage()) {
  return { store, classifier: new MockClassifier(), storage };
}

function email(
  text: string,
  from = "owner@host.com",
  messageId = "inbound-1@sg",
): InboundEmail {
  return parseInboundParse({
    from,
    to: "replies@offers.brand.com",
    subject: "Re: cash offer",
    text,
    headers: `In-Reply-To: <msg-1@sg>\r\nMessage-ID: <${messageId}>`,
  });
}

describe("handleInboundReply — the gated loop", () => {
  let storage: MockStorage;
  beforeEach(() => {
    storage = new MockStorage();
  });

  it("'yes I'd take an offer' -> reply + QUEUED contract (priced at your_mao) + Contacted deal", async () => {
    const store = new FakeStore(warmCtx);
    const t0 = Date.now();
    const r = await handleInboundReply(
      email("Yes, I'd take an offer. How much?"),
      deps(store, storage),
    );
    const elapsed = Date.now() - t0;

    expect(r.intent).toBe("interested");
    expect(store.replies).toHaveLength(1);

    // Contract: exactly one, queued, priced at your_mao, with a stored PDF.
    expect(store.contracts).toHaveLength(1);
    const c = store.contracts[0]!;
    expect(c.status).toBe("queued");
    expect(c.offer_price).toBe(158000);
    expect(r.contractId).toBeTruthy();
    expect(c.pdf_url).toMatch(/^mock:\/\/contracts\//);

    // The PDF actually landed in storage and is a real PDF.
    expect(storage.objects.size).toBe(1);
    const bytes = [...storage.objects.values()][0]!;
    expect(String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!)).toBe("%PDF");

    // Desk deal created at Contacted.
    expect(store.deals).toHaveLength(1);
    expect(store.deals[0]!.stage).toBe("Contacted");

    // Well under the 60s SLA.
    expect(elapsed).toBeLessThan(60_000);
  });

  it("'remove me' -> suppression, NO contract, NO deal", async () => {
    const store = new FakeStore(warmCtx);
    const r = await handleInboundReply(
      email("Please remove me from your list and never contact me again"),
      deps(store, storage),
    );
    expect(r.intent).toBe("do_not_contact");
    expect(r.suppressed).toBe(true);
    expect(store.suppressions).toEqual([
      { email: "owner@host.com", reason: "do_not_contact" },
    ]);
    expect(store.contracts).toHaveLength(0);
    expect(store.deals).toHaveLength(0);
    expect(storage.objects.size).toBe(0);
  });

  it("'not interested' -> reply only, no contract/deal/suppression", async () => {
    const store = new FakeStore(warmCtx);
    const r = await handleInboundReply(email("not interested, thanks"), deps(store, storage));
    expect(r.intent).toBe("not_now");
    expect(store.replies).toHaveLength(1);
    expect(store.contracts).toHaveLength(0);
    expect(store.deals).toHaveLength(0);
    expect(store.suppressions).toHaveLength(0);
  });

  it("interested but missing your_mao -> warm deal surfaced, but no contract", async () => {
    const store = new FakeStore({ ...warmCtx, yourMao: null });
    const r = await handleInboundReply(email("yes, interested!"), deps(store, storage));
    expect(r.intent).toBe("interested");
    expect(store.contracts).toHaveLength(0);
    expect(store.deals).toHaveLength(1); // lead still surfaced
    expect(r.note).toMatch(/missing underwrite/);
  });

  it("is idempotent — a re-delivered webhook (same Message-ID) makes no second contract/deal", async () => {
    const store = new FakeStore(warmCtx);
    const msg = email("Yes, I'd take an offer!");

    const first = await handleInboundReply(msg, deps(store, storage));
    expect(first.intent).toBe("interested");
    expect(store.contracts).toHaveLength(1);
    expect(store.deals).toHaveLength(1);
    expect(store.replies).toHaveLength(1);

    const retry = await handleInboundReply(msg, deps(store, storage));
    expect(retry.duplicate).toBe(true);
    // No new rows on the retry.
    expect(store.contracts).toHaveLength(1);
    expect(store.deals).toHaveLength(1);
    expect(store.replies).toHaveLength(1);
  });
});
