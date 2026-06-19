import type { CSSProperties } from "react";
import Link from "next/link";
import { Fraunces, JetBrains_Mono } from "next/font/google";
import type { DealStage, Underwrite } from "@parcel/types";
import { getDealViews } from "@/lib/views";
import { getDeals, getProperties, getUnderwrites, isLive } from "@/lib/data";
import { computeNextAction, nextActionHref } from "@/lib/next-action";
import { scoreLead } from "@/lib/scoring";
import { RealtimeBoundary } from "@/components/RealtimeBoundary";
import { usd } from "@/lib/format";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const display = Fraunces({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

const MONTHLY_GOAL = 10_000;
const FARM = { label: "MISSOULA · MONTANA", lat: 46.8721, lng: -113.994 };
const CLEARING: DealStage[] = ["Under contract", "Assigned", "Closed"];

const isThisMonth = (iso: string): boolean => {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
};

const delay = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

export default async function HomePage() {
  const [views, properties, underwrites, deals] = await Promise.all([
    getDealViews(),
    getProperties(),
    getUnderwrites(),
    getDeals(),
  ]);

  const items = views
    .map((v) => {
      const action = computeNextAction({
        stage: v.deal.stage,
        verdict: v.underwrite?.verdict ?? null,
        contractStatus: v.contract?.status ?? null,
        assigned: !!v.assignedBuyer,
      });
      return {
        id: v.deal.id,
        action,
        address: v.property?.address ?? "Unknown property",
        profit: v.underwrite?.fee_potential ?? null,
        // Fall back to the deal page when an action has no specific target —
        // viewing the deal is always a sensible destination.
        href: nextActionHref(action, v.deal.id) ?? `/deals/${v.deal.id}`,
      };
    })
    .sort((a, b) => a.action.priority - b.action.priority);

  const hero = items.find((i) => i.action.tone === "do") ?? items[0];
  const rest = items.filter((i) => i.id !== hero?.id);

  // Money pace to the $10k month (mirrors the dashboard money math).
  const monthFee = views
    .filter((v) => CLEARING.includes(v.deal.stage) && isThisMonth(v.deal.created_at))
    .reduce((sum, v) => sum + (v.underwrite?.fee_potential ?? 0), 0);
  const pct = Math.min(100, Math.round((monthFee / MONTHLY_GOAL) * 100));

  // Hot leads = not-yet-worked properties the motivation score rates "hot".
  const dealPropIds = new Set(deals.map((d) => d.property_id));
  const uwByProp = new Map<string, Underwrite>();
  for (const u of underwrites) {
    if (!u.property_id) continue;
    const ex = uwByProp.get(u.property_id);
    if (!ex || u.created_at > ex.created_at) uwByProp.set(u.property_id, u);
  }
  const hotLeads = properties
    .filter((p) => !dealPropIds.has(p.id))
    .reduce((n, p) => {
      const s = scoreLead({
        signals: p.distress_signals ?? [],
        feePotential: uwByProp.get(p.id)?.fee_potential ?? null,
      });
      return n + (s.tier === "hot" ? 1 : 0);
    }, 0);

  const counts = {
    do: items.filter((i) => i.action.tone === "do").length,
    approve: views.filter((v) => v.contract?.status === "queued").length,
    closed: views.filter((v) => v.deal.stage === "Closed").length,
  };

  const live = isLive();

  // money dial geometry
  const R = 44;
  const C = 2 * Math.PI * R;
  const off = C * (1 - pct / 100);

  return (
    <div className={`${display.variable} ${mono.variable} ${styles.root}`}>
      <RealtimeBoundary tables={["deals", "contracts", "properties"]} />

      <div className={styles.slab}>
        <div className={styles.inner}>
          {/* instrument top bar */}
          <header className={`${styles.topbar} ${styles.reveal}`} style={delay(0)}>
            <span className={styles.wordmark}>Parcel · Command</span>
            <span className={styles.coord}>
              {FARM.lat.toFixed(4)}°N · {Math.abs(FARM.lng).toFixed(4)}°W — {FARM.label}
            </span>
            <span className={styles.status} title={live ? "Live database" : "Demo data"}>
              <span className={`${styles.dot} ${live ? "" : styles.dotDemo}`} aria-hidden />
              {live ? "Live" : "Demo"}
            </span>
          </header>

          {/* headline */}
          <div className={`${styles.lede} ${styles.reveal}`} style={delay(80)}>
            <p className={styles.kicker}>Survey of the board</p>
            <h1 className={styles.headline}>
              One move<br />
              to the next <em>$10k</em>.
            </h1>
            <p className={styles.subhead}>
              Parcel sources distressed parcels, scores them, and works the
              outreach. You make one decision at a time — the most valuable one first.
            </p>
          </div>

          {/* the single next move */}
          {hero ? (
            <Link
              href={hero.href}
              className={`${styles.field} ${styles.reveal} ${
                hero.action.tone === "done" ? styles.fieldGo : ""
              }`}
              style={delay(160)}
            >
              <span className={`${styles.tick} ${styles.tickTL}`} aria-hidden />
              <span className={`${styles.tick} ${styles.tickTR}`} aria-hidden />
              <span className={`${styles.tick} ${styles.tickBL}`} aria-hidden />
              <span className={`${styles.tick} ${styles.tickBR}`} aria-hidden />
              <span className={styles.fieldTone}>Your next move</span>
              <p className={styles.fieldStatus}>{hero.action.statusLine}</p>
              <p className={styles.fieldStep}>{hero.action.step} — {hero.action.how}</p>
              <div className={styles.fieldMeta}>
                <span className={styles.fieldAddr}>◷ {hero.address}</span>
                {hero.profit != null && (
                  <span className={styles.fieldProfit}>
                    est. fee <b>{usd(hero.profit)}</b>
                  </span>
                )}
                {hero.action.cta && (
                  <span className={styles.cta}>
                    {hero.action.cta} <span className={styles.arrow}>→</span>
                  </span>
                )}
              </div>
            </Link>
          ) : (
            <div className={`${styles.empty} ${styles.reveal}`} style={delay(160)}>
              <span className={styles.fieldTone}>Empty plat</span>
              <p className={styles.emptyTitle}>No deals on the board yet.</p>
              <p className={styles.emptyBody}>
                Hit <b>Find leads</b> in the top bar. Parcel pulls distressed
                parcels, skip-traces owners, and underwrites the numbers — then the
                hottest lead shows up right here.
              </p>
            </div>
          )}

          {/* instrument cluster: money dial + readouts */}
          <div className={`${styles.cluster} ${styles.reveal}`} style={delay(260)}>
            <div className={styles.dialCard}>
              <div className={styles.dial}>
                <svg width="104" height="104" viewBox="0 0 104 104" aria-hidden>
                  <circle className={styles.dialTrack} cx="52" cy="52" r={R} />
                  <circle
                    className={styles.dialFill}
                    cx="52"
                    cy="52"
                    r={R}
                    strokeDasharray={C}
                    style={{ ["--c"]: `${C}`, ["--off"]: `${off}` } as CSSProperties}
                  />
                </svg>
                <div className={styles.dialPct}>
                  <span className={styles.dialPctNum}>{pct}</span>
                  <span className={styles.dialPctLbl}>percent</span>
                </div>
              </div>
              <div className={styles.dialMeta}>
                <p className={styles.dialLabel}>Pace to goal · this month</p>
                <p className={styles.dialValue}>
                  {usd(monthFee)} <span>/ {usd(MONTHLY_GOAL)}</span>
                </p>
                <p className={styles.dialNote}>One ~$10k assignment clears the month.</p>
              </div>
            </div>

            <div className={styles.readouts}>
              <Readout num={hotLeads} label="Hot leads" tone={hotLeads > 0 ? "do" : undefined} />
              <Readout num={counts.do} label="Needs you now" tone={counts.do > 0 ? "do" : undefined} />
              <Readout
                num={counts.approve}
                label="To approve"
                tone={counts.approve > 0 ? "do" : undefined}
                href="/contracts"
              />
              <Readout num={counts.closed} label="Closed · paid" tone="go" />
            </div>
          </div>

          {/* the rest of the list — survey ledger */}
          {rest.length > 0 && (
            <div className={`${styles.reveal}`} style={delay(360)}>
              <div className={styles.sectionHead}>
                <span className={styles.sectionTitle}>The rest of the field</span>
                <span className={styles.sectionRule} />
                <span className={styles.sectionIdx}>{rest.length} plotted</span>
              </div>
              <div className={styles.ledger}>
                {rest.map((i) => (
                  <Link key={i.id} href={i.href} className={styles.row}>
                    <span className={styles.rowFlag} data-tone={i.action.tone} />
                    <span className={styles.rowBody}>
                      <span className={styles.rowAddr}>{i.address}</span>
                      <span className={styles.rowStep}>{i.action.statusLine}</span>
                    </span>
                    {i.profit != null && (
                      <span className={styles.rowProfit}>{usd(i.profit)}</span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* footer nav + how it works */}
          <div className={`${styles.reveal}`} style={delay(460)}>
            <nav className={styles.foot} aria-label="Desk sections">
              <Link href="/leads" className={styles.footLink}>→ Browse leads</Link>
              <Link href="/pipeline" className={styles.footLink}>→ Full pipeline</Link>
              <Link href="/dashboard" className={styles.footLink}>→ Scoreboards</Link>
              <Link href="/setup" className={styles.footLink}>→ Setup</Link>
            </nav>

            <details className={styles.how}>
              <summary className={styles.howSummary}>New here? How Parcel pays you, in 5 steps</summary>
              <ol className={styles.steps}>
                {HOW.map(([t, b], i) => (
                  <li key={t} className={styles.step}>
                    <span className={styles.stepNo}>0{i + 1}</span>
                    <span className={styles.stepText}>
                      <b>{t}.</b> {b}
                    </span>
                  </li>
                ))}
              </ol>
              <p className={styles.howNote}>
                You earn the assignment fee — the gap between your contract price and
                what your cash buyer pays. Target: about one $10k deal a month.
              </p>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}

const HOW: [string, string][] = [
  ["Find leads", "Pull distressed parcels; Parcel scores and underwrites them."],
  ["Make an offer", "Owners get a compliant cash offer to buy — automatically."],
  ["Seller says yes", "A draft contract appears. You approve & send it (one click)."],
  ["Find a buyer", "Match a cash buyer and send them the deal package."],
  ["Close & get paid", "Work the closing checklist; collect your fee."],
];

function Readout({
  num,
  label,
  tone,
  href,
}: {
  num: number;
  label: string;
  tone?: "do" | "go";
  href?: string;
}) {
  const body = (
    <>
      <div className={styles.readoutNum} data-tone={tone}>
        {num}
      </div>
      <div className={styles.readoutLbl}>{href ? `${label} →` : label}</div>
    </>
  );
  return href ? (
    <Link href={href} className={`${styles.readout} ${styles.readoutLink}`}>
      {body}
    </Link>
  ) : (
    <div className={styles.readout}>{body}</div>
  );
}
