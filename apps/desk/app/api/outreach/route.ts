// Run the owner-outreach campaign — the action that turns clearing leads into
// replies (which the inbound webhook gates into queued contracts). Sends the
// 3-touch sequence to owners of verdict='clear' properties, CAN-SPAM-compliant,
// honoring the suppression list. Mock provider until SendGrid is configured.
// Node runtime / service-role. 202s when the DB isn't configured.
import type { NextRequest } from "next/server";
import type { Campaign } from "@parcel/types";
import {
  runCampaign,
  makeProvider,
  makePersonalizer,
  configFromEnv,
} from "@parcel/outreach";
import { createServiceClient, OutreachDbStore, type Db } from "@parcel/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getOrCreateCampaign(db: Db): Promise<Campaign> {
  const { data } = await db.from("campaigns").select("*").limit(1);
  const existing = (data as Campaign[] | null)?.[0];
  if (existing) return existing;
  const { data: created } = await db
    .from("campaigns")
    .insert({
      name: "Default outreach",
      status: "active",
      from_domain: process.env.SENDGRID_FROM_DOMAIN ?? "offers.example.com",
      daily_cap: 50,
    })
    .select()
    .single();
  return created as Campaign;
}

export async function POST(_req: NextRequest): Promise<Response> {
  let db: Db;
  try {
    db = createServiceClient();
  } catch {
    return Response.json(
      { ok: false, reason: "database not configured" },
      { status: 202 },
    );
  }

  try {
    const campaign = await getOrCreateCampaign(db);
    const result = await runCampaign(
      {
        store: new OutreachDbStore(db),
        provider: makeProvider(),
        personalizer: makePersonalizer(),
        config: configFromEnv(),
      },
      { campaign, ramp: 0.2 }, // gentle warmup ramp (20% of daily_cap)
    );
    return Response.json({ ok: true, result });
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "outreach failed" },
      { status: 500 },
    );
  }
}
