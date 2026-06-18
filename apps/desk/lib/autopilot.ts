// The autopilot: one daily pass of the funnel's front half so the engine runs
// without a human clicking. Pull fresh free leads → skip-trace → underwrite →
// send each owner the outreach touch they're DUE for today. The ONLY thing it
// never does is send a contract — that stays a human one-click (CLAUDE.md #3).
// server-only — uses the service-role DB client + service packages.
import "server-only";
import type { Campaign } from "@parcel/types";
import {
  createProvider as createPropertyProvider,
  runPull,
} from "@parcel/sourcing";
import {
  createProvider as createSkiptraceProvider,
  runSkiptrace,
} from "@parcel/skiptrace";
import { runUnderwriting, MockCompsProvider } from "@parcel/underwriting";
import {
  runDueTouches,
  makeProvider,
  makePersonalizer,
  configFromEnv,
} from "@parcel/outreach";
import {
  createServiceClient,
  SourcingDbStore,
  SkiptraceDbStore,
  UnderwriteDbStore,
  OutreachDbStore,
  type Db,
} from "@parcel/db";

// Default farm area = Missoula, MT (matches the manual "Find leads" button).
const DEFAULT_LAT = 46.8721;
const DEFAULT_LNG = -113.994;
const DEFAULT_RADIUS_MILES = 15;
const DEFAULT_RAMP = 0.2; // gentle domain warmup, same as the manual send

export interface AutopilotConfig {
  /** Master switch. Off → a run is a no-op (lets you pause without un-deploying). */
  enabled: boolean;
  /** Whether to pull fresh leads each run (cheap: dedup makes re-pulls free). */
  pull: boolean;
  farm: { lat: number; lng: number; radiusMiles: number };
  /** Outreach daily-cap ramp in [0,1]. */
  ramp: number;
}

const num = (v: string | undefined, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export function autopilotConfig(): AutopilotConfig {
  const env = process.env;
  return {
    enabled: env.AUTOPILOT_ENABLED !== "false",
    pull: env.AUTOPILOT_PULL !== "false",
    farm: {
      lat: num(env.AUTOPILOT_LAT, DEFAULT_LAT),
      lng: num(env.AUTOPILOT_LNG, DEFAULT_LNG),
      radiusMiles: num(env.AUTOPILOT_RADIUS_MILES, DEFAULT_RADIUS_MILES),
    },
    ramp: num(env.AUTOPILOT_RAMP, DEFAULT_RAMP),
  };
}

export interface AutopilotResult {
  ran: boolean;
  reason?: string;
  ranAt: string;
  sourcing?: Awaited<ReturnType<typeof runPull>>;
  skiptrace?: Awaited<ReturnType<typeof runSkiptrace>>;
  underwriting?: Awaited<ReturnType<typeof runUnderwriting>>;
  outreach?: Awaited<ReturnType<typeof runDueTouches>>;
}

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

/**
 * Run one autopilot pass. Returns a per-stage summary (or `ran: false` with a
 * reason when paused / DB not configured). Each stage is idempotent: sourcing
 * dedupes, skip-trace/underwrite only touch pending rows, and outreach sends
 * just the due touch per owner — so a daily schedule never double-acts.
 */
export async function runAutopilot(): Promise<AutopilotResult> {
  const ranAt = new Date().toISOString();
  const cfg = autopilotConfig();
  if (!cfg.enabled) return { ran: false, reason: "autopilot disabled", ranAt };

  let db: Db;
  try {
    db = createServiceClient();
  } catch {
    return { ran: false, reason: "database not configured", ranAt };
  }

  const sourcing = cfg.pull
    ? await runPull(createPropertyProvider(), new SourcingDbStore(db), {
        lat: cfg.farm.lat,
        lng: cfg.farm.lng,
        radiusMiles: cfg.farm.radiusMiles,
        filters: {},
      })
    : undefined;

  const skiptrace = await runSkiptrace(
    createSkiptraceProvider(),
    new SkiptraceDbStore(db),
  );
  const underwriting = await runUnderwriting(new UnderwriteDbStore(db), {
    compsProvider: new MockCompsProvider(),
  });

  const campaign = await getOrCreateCampaign(db);
  const outreach = await runDueTouches(
    {
      store: new OutreachDbStore(db),
      provider: makeProvider(),
      personalizer: makePersonalizer(),
      config: configFromEnv(),
    },
    { campaign, ramp: cfg.ramp },
  );

  return { ran: true, ranAt, sourcing, skiptrace, underwriting, outreach };
}
