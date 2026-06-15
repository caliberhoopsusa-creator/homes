import { describe, it, expect } from "vitest";
import type {
  Campaign,
  Message,
  MessageInsert,
  MessageStatus,
  Owner,
  Property,
} from "@parcel/types";
import { runCampaign, type OutreachStore, type ClearingOwner } from "../src/run.js";
import { MockProvider } from "../src/provider.js";
import { MockPersonalizer } from "../src/personalizer.js";
import { configFromEnv, type OutreachConfig } from "../src/config.js";
import { unsubscribeToken } from "../src/compliance.js";

const CFG: OutreachConfig = configFromEnv({
  MAILING_ADDRESS: "Parcel LLC, 123 Test St, Billings, MT 59101",
  UNSUBSCRIBE_BASE_URL: "https://parcel.test/u",
  OUTREACH_REPLY_TO: "offers@parcel.test",
  OUTREACH_FROM_NAME: "Parcel",
});

function prop(p: Partial<Property> = {}): Property {
  return {
    id: "prop1",
    source: "batchdata",
    source_id: "x",
    address: "1 Main St",
    city: "Billings",
    state: "MT",
    zip: "59101",
    lat: null,
    lng: null,
    beds: 3,
    baths: 2,
    sqft: 1500,
    year_built: 1980,
    est_value: 300_000,
    asking: null,
    distress_signals: ["absentee"],
    created_at: "2026-01-01T00:00:00Z",
    ...p,
  };
}

function owner(o: Partial<Owner> = {}): Owner {
  return {
    id: "owner1",
    property_id: "prop1",
    full_name: "Pat Owner",
    email: "pat@example.com",
    phone: null,
    mailing_address: null,
    skiptrace_status: "matched",
    skiptrace_confidence: 0.9,
    created_at: "2026-01-01T00:00:00Z",
    ...o,
  };
}

function campaign(c: Partial<Campaign> = {}): Campaign {
  return {
    id: "camp1",
    name: "Q2 Billings",
    status: "active",
    from_domain: "buy.parcel.test",
    daily_cap: 100,
    created_at: "2026-01-01T00:00:00Z",
    ...c,
  };
}

/** In-memory store. Suppression seeded by email; logs messages + transitions. */
class FakeStore implements OutreachStore {
  messages: (MessageInsert & { id: string })[] = [];
  transitions: { id: string; status: MessageStatus }[] = [];
  sentToday = 0;
  private seq = 0;

  constructor(
    private owners: ClearingOwner[],
    private suppressed: Set<string> = new Set(),
  ) {}

  async clearingOwners() {
    return this.owners;
  }
  async isSuppressed(email: string) {
    return this.suppressed.has(email.toLowerCase());
  }
  async insertMessage(row: MessageInsert) {
    this.seq += 1;
    const id = `msg-${this.seq}`;
    this.messages.push({ ...row, id });
    return { id };
  }
  async recordStatus(id: string, status: MessageStatus) {
    this.transitions.push({ id, status });
  }
  async sentTodayCount() {
    return this.sentToday;
  }
}

describe("runCampaign — suppression (CAN-SPAM non-negotiable)", () => {
  it("NEVER messages a seeded do_not_contact owner", async () => {
    const dncEmail = "blocked@example.com";
    const owners: ClearingOwner[] = [
      { owner: owner({ id: "blk", email: dncEmail }), property: prop() },
    ];
    // do_not_contact suppression seeded.
    const store = new FakeStore(owners, new Set([dncEmail]));
    const provider = new MockProvider();

    const res = await runCampaign(
      { store, provider, personalizer: new MockPersonalizer(), config: CFG },
      { campaign: campaign() },
    );

    expect(res.sent).toBe(0);
    expect(res.suppressed).toBe(1);
    expect(provider.sent).toHaveLength(0); // nothing hit the wire
    expect(store.messages).toHaveLength(0); // nothing logged
  });
});

describe("runCampaign — happy path (queued→sent + CAN-SPAM footer)", () => {
  it("logs queued→sent with mailing address + unsubscribe token in body", async () => {
    const o = owner({ id: "owner1", email: "pat@example.com" });
    const store = new FakeStore([{ owner: o, property: prop() }]);
    const provider = new MockProvider();

    const res = await runCampaign(
      { store, provider, personalizer: new MockPersonalizer(), config: CFG },
      { campaign: campaign() },
    );

    expect(res.sent).toBe(1);
    expect(store.messages).toHaveLength(1);

    const logged = store.messages[0]!;
    expect(logged.status).toBe("queued"); // logged queued first
    expect(logged.owner_id).toBe("owner1");
    expect(logged.campaign_id).toBe("camp1");
    expect(logged.direction).toBe("outbound");

    // queued → sent transition recorded.
    expect(store.transitions).toEqual([{ id: logged.id, status: "sent" }]);

    // CAN-SPAM footer present: physical mailing address + per-owner token.
    expect(logged.body).toContain("Parcel LLC, 123 Test St, Billings, MT 59101");
    expect(logged.body).toContain(unsubscribeToken("owner1"));

    // MT broker line: offer to buy, never "for sale".
    expect(logged.body).toContain("not listed for sale");

    // provider got a fully-built compliant body.
    const wire = provider.sent[0]!;
    expect(wire.body).toBe(logged.body);
    expect(wire.to).toBe("pat@example.com");
    expect(wire.replyTo).toBe("offers@parcel.test");
  });
});

describe("runCampaign — daily cap with ramp", () => {
  it("sends no more than the ramped cap and defers the rest", async () => {
    const owners: ClearingOwner[] = Array.from({ length: 5 }, (_, i) => ({
      owner: owner({ id: `o${i}`, email: `o${i}@example.com` }),
      property: prop({ id: `p${i}` }),
    }));
    const store = new FakeStore(owners);
    const provider = new MockProvider();

    // daily_cap 10, ramp 0.2 => effective cap 2.
    const res = await runCampaign(
      { store, provider, config: CFG },
      { campaign: campaign({ daily_cap: 10 }), ramp: 0.2 },
    );

    expect(res.sent).toBe(2);
    expect(res.capped).toBe(3);
    expect(provider.sent).toHaveLength(2);
    expect(store.messages).toHaveLength(2);
  });

  it("respects messages already sent today", async () => {
    const owners: ClearingOwner[] = Array.from({ length: 3 }, (_, i) => ({
      owner: owner({ id: `o${i}`, email: `o${i}@example.com` }),
      property: prop({ id: `p${i}` }),
    }));
    const store = new FakeStore(owners);
    store.sentToday = 9; // cap 10, 9 already sent => only 1 left

    const res = await runCampaign(
      { store, config: CFG },
      { campaign: campaign({ daily_cap: 10 }) },
    );

    expect(res.sent).toBe(1);
    expect(res.capped).toBe(2);
  });
});

describe("runCampaign — owners without email are skipped", () => {
  it("ignores owners with no email address", async () => {
    const store = new FakeStore([
      { owner: owner({ id: "no-email", email: null }), property: prop() },
    ]);
    const res = await runCampaign({ store, config: CFG }, { campaign: campaign() });
    expect(res.considered).toBe(0);
    expect(res.sent).toBe(0);
  });
});
