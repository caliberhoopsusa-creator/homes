import { describe, it, expect } from "vitest";
import type {
  Campaign,
  MessageInsert,
  MessageStatus,
  Owner,
  Property,
} from "@parcel/types";
import {
  runDueTouches,
  type OutreachStore,
  type ClearingOwner,
} from "../src/run.js";
import { type OwnerTouchState } from "../src/schedule.js";
import { configFromEnv } from "../src/config.js";

const CFG = configFromEnv({
  MAILING_ADDRESS: "Parcel LLC, 123 Test St, Billings, MT 59101",
  UNSUBSCRIBE_BASE_URL: "https://parcel.test/u",
});
const NOW = new Date("2026-06-18T12:00:00Z");
const daysAgo = (n: number): string =>
  new Date(NOW.getTime() - n * 86_400_000).toISOString();

function owner(id: string): Owner {
  return {
    id,
    property_id: `p-${id}`,
    full_name: "Pat",
    email: `${id}@example.com`,
    phone: null,
    mailing_address: null,
    skiptrace_status: "matched",
    skiptrace_confidence: 0.9,
    created_at: "2026-01-01T00:00:00Z",
  };
}
function prop(id: string): Property {
  return {
    id: `p-${id}`,
    source: "county",
    source_id: id,
    address: `${id} Main St`,
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
  };
}
const campaign: Campaign = {
  id: "camp1",
  name: "C",
  status: "active",
  from_domain: "buy.parcel.test",
  daily_cap: 100,
  created_at: "2026-01-01T00:00:00Z",
};

class FakeStore implements OutreachStore {
  messages: (MessageInsert & { id: string })[] = [];
  private seq = 0;
  constructor(
    private owners: ClearingOwner[],
    private history: Map<string, OwnerTouchState>,
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
  async recordStatus() {}
  async sentTodayCount() {
    return 0;
  }
  async outreachHistory() {
    return this.history;
  }
}

describe("runDueTouches — cadence-aware autopilot send", () => {
  it("sends the correct next step per owner and skips not-due ones", async () => {
    const owners: ClearingOwner[] = [
      { owner: owner("new"), property: prop("new") }, // no history → step 1
      { owner: owner("due"), property: prop("due") }, // step 1, 3d ago → step 2
      { owner: owner("wait"), property: prop("wait") }, // step 1, 1d ago → not due
      { owner: owner("done"), property: prop("done") }, // step 6 → finished
    ];
    const history = new Map<string, OwnerTouchState>([
      ["due", { lastStep: 1, lastSentAt: daysAgo(3) }],
      ["wait", { lastStep: 1, lastSentAt: daysAgo(1) }],
      ["done", { lastStep: 6, lastSentAt: daysAgo(60) }],
    ]);
    const store = new FakeStore(owners, history);

    const result = await runDueTouches(
      { store, config: CFG },
      { campaign, now: NOW },
    );

    expect(result.considered).toBe(4);
    expect(result.sent).toBe(2);
    expect(result.notDue).toBe(2);
    expect(result.byStep).toEqual({ 1: 1, 2: 1 });
    const steps = store.messages.map((m) => ({ owner: m.owner_id, step: m.step }));
    expect(steps).toContainEqual({ owner: "new", step: 1 });
    expect(steps).toContainEqual({ owner: "due", step: 2 });
  });

  it("never messages a suppressed owner even when a touch is due", async () => {
    const owners: ClearingOwner[] = [
      { owner: owner("blk"), property: prop("blk") },
    ];
    const store = new FakeStore(
      owners,
      new Map(),
      new Set(["blk@example.com"]),
    );
    const result = await runDueTouches(
      { store, config: CFG },
      { campaign, now: NOW },
    );
    expect(result.sent).toBe(0);
    expect(result.suppressed).toBe(1);
    expect(store.messages).toHaveLength(0);
  });

  it("respects the daily cap (ramp)", async () => {
    const owners: ClearingOwner[] = Array.from({ length: 5 }, (_, i) => ({
      owner: owner(`o${i}`),
      property: prop(`o${i}`),
    }));
    const store = new FakeStore(owners, new Map()); // all due step 1
    const capped: Campaign = { ...campaign, daily_cap: 2 };
    const result = await runDueTouches(
      { store, config: CFG },
      { campaign: capped, now: NOW, ramp: 1 },
    );
    expect(result.sent).toBe(2);
    expect(result.capped).toBe(3);
  });
});
