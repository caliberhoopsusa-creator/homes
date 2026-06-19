import { describe, it, expect } from "vitest";
import type {
  Buyer,
  Contract,
  Deal,
  Message,
  Property,
  Reply,
  Underwrite,
} from "@parcel/types";
import {
  computeScoreboards,
  type Board,
  type ScoreboardsInput,
} from "../lib/scoreboards";

const NOW = new Date("2026-06-18T12:00:00Z");
const THIS_MONTH = "2026-06-10T00:00:00Z";
const LAST_MONTH = "2026-05-10T00:00:00Z";

function prop(id: string, created = THIS_MONTH): Property {
  return {
    id,
    source: "county",
    source_id: id,
    address: `${id} St`,
    city: "Billings",
    state: "MT",
    zip: "59101",
    lat: null,
    lng: null,
    beds: 3,
    baths: 2,
    sqft: 1500,
    year_built: 1980,
    est_value: 250_000,
    asking: null,
    distress_signals: ["absentee"],
    created_at: created,
  };
}
function msg(over: Partial<Message>): Message {
  return {
    id: Math.random().toString(36).slice(2),
    campaign_id: "c1",
    owner_id: "o1",
    step: 1,
    direction: "outbound",
    subject: "s",
    body: "b",
    status: "sent",
    provider_id: null,
    sent_at: THIS_MONTH,
    created_at: THIS_MONTH,
    kind: "seller_outreach",
    ...over,
  };
}
function reply(over: Partial<Reply>): Reply {
  return {
    id: Math.random().toString(36).slice(2),
    message_id: "m1",
    owner_id: "o1",
    provider_id: null,
    raw_text: "yes",
    intent: "interested",
    intent_confidence: 0.9,
    created_at: THIS_MONTH,
    ...over,
  };
}
function deal(stage: Deal["stage"], created = THIS_MONTH, property_id = "p1"): Deal {
  return {
    id: Math.random().toString(36).slice(2),
    property_id,
    stage,
    assigned_buyer_id: null,
    title_company: null,
    closing_date: null,
    created_at: created,
  } as Deal;
}
const empty: ScoreboardsInput = {
  properties: [],
  messages: [],
  replies: [],
  contracts: [],
  deals: [],
  buyers: [],
  underwrites: [],
  now: NOW,
};

const stat = (board: Board, label: string) =>
  board.stats.find((s) => s.label === label)!;

describe("computeScoreboards", () => {
  it("returns zeroed boards for no data", () => {
    const s = computeScoreboards(empty);
    expect(s.marketing.stats.every((x) => x.value === 0)).toBe(true);
    expect(s.dispositions.stats.every((x) => x.value === 0)).toBe(true);
  });

  it("counts leads sourced with a this-month breakdown", () => {
    const s = computeScoreboards({
      ...empty,
      properties: [prop("p1", THIS_MONTH), prop("p2", LAST_MONTH)],
    });
    const leads = stat(s.marketing, "Leads sourced");
    expect(leads.value).toBe(2);
    expect(leads.sub).toBe("1 this month");
  });

  it("counts only sent seller-outreach emails (not buyer dispo, not queued)", () => {
    const s = computeScoreboards({
      ...empty,
      messages: [
        msg({ sent_at: THIS_MONTH }),
        msg({ status: "queued", sent_at: null }), // not sent
        msg({ kind: "buyer_dispo", sent_at: THIS_MONTH }), // dispo, not marketing
      ],
    });
    expect(stat(s.marketing, "Owners emailed").value).toBe(1);
    expect(stat(s.dispositions, "Buyers on list").sub).toBe("1 dispo emails sent");
  });

  it("counts interested sellers separately from all replies", () => {
    const s = computeScoreboards({
      ...empty,
      replies: [
        reply({ intent: "interested" }),
        reply({ intent: "not_now" }),
        reply({ intent: "interested" }),
      ],
    });
    expect(stat(s.marketing, "Replies").value).toBe(3);
    expect(stat(s.acquisitions, "Interested sellers").value).toBe(2);
  });

  it("rolls deals up the stages (under-contract includes assigned + closed)", () => {
    const s = computeScoreboards({
      ...empty,
      deals: [
        deal("Lead"),
        deal("Under contract"),
        deal("Assigned"),
        deal("Closed"),
      ],
    });
    expect(stat(s.acquisitions, "Under contract").value).toBe(3); // UC + Assigned + Closed
    expect(stat(s.dispositions, "Deals assigned").value).toBe(2); // Assigned + Closed
  });

  it("sums fees earned from closed deals this month via underwrite fee_potential", () => {
    const closed = deal("Closed", THIS_MONTH, "p9");
    const underwrites = [
      { property_id: "p9", fee_potential: 11000 } as Underwrite,
    ];
    const s = computeScoreboards({ ...empty, deals: [closed], underwrites });
    const fees = stat(s.dispositions, "Fees earned");
    expect(fees.value).toBe(11000);
    expect(fees.money).toBe(true);
  });
});
