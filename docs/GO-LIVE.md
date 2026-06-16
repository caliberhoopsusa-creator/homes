# Parcel — Go-Live Runbook (mocks → first deal)

> Parcel is built and green, running on **mock providers with zero keys**. This is the
> ordered path to a real assignment. Every step tagged **[FREE]** or **[PAID]**.
> Companion docs: `docs/DELIVERABILITY.md`, `docs/MONTANA-LEGAL.md`, `docs/RESEARCH-wholesaling.md`.
> *Not legal/financial advice. Verify live vendor pricing — it moves.*

## Cost summary (cheapest viable, mid-2026)

| Item | Cheapest path | ~Cost |
|---|---|---|
| Database (Supabase) | **Free tier** (pauses after ~1 wk idle; Pro $25/mo when you outgrow it) | **$0** |
| Property/owner data | **Free county-records path** (built: `PROPERTY_PROVIDER=county`) — *or* PropStream ~$99/mo | **$0**–$99/mo |
| Email send (SendGrid) | 60-day trial (100/day) → **Essentials** ($19.95/mo, 50k emails) | ~$20/mo |
| Sending domain | `.com` at Cloudflare/Porkbun (~$10/yr); subdomain + SPF/DKIM/DMARC free | ~$10/yr |
| AI (Anthropic) | Haiku-class model for reply classification at this volume | ~**$1–5/mo** |
| **Legal — MT attorney review of the assignment template** | **the hard gate** (one-time) | **$$ one-time** |

**Bottom line:** you can run the software end-to-end for **≈ $20/mo + ~$10/yr** using the free county-data path. The two real spends are (a) a property-data provider *if you skip the free county path*, and (b) the **non-negotiable one-time attorney review**.

---

## Phase 1 — Stand up infra  [FREE]
1. Create a **Supabase** project (free tier).
2. Apply the schema: run `supabase/migrations/0001_init.sql` in the SQL editor (or `supabase db push`).
3. Set env (`.env` from `.env.example`): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. The desk auto-switches from fixtures to live once `NEXT_PUBLIC_SUPABASE_*` are set (`apps/desk/lib/data.ts`).
> ⚠️ Free tier pauses after ~1 week of inactivity — fine for dev; upgrade to Pro ($25/mo) for always-on.

## Phase 2 — Get real leads flowing  [FREE or PAID]
**Free path (built):** set `PROPERTY_PROVIDER=county` + `COUNTY_RECORDS_SOURCES` (JSON array of normalized county-record endpoints). You'll need a small per-county adapter to turn raw county tax-delinquent/probate/code-violation pages into the normalized JSON the provider expects (see issue: free county-records provider). **No data fees.**
**Paid path:** `PROPERTY_PROVIDER=batchdata` (+`BATCHDATA_API_KEY`) or PropStream — instant nationwide data, ~$99/mo.
Then run a radius pull from the desk's **"Pull" button** → `/api/pull` runs sourcing → skiptrace → underwriting against Postgres.
> ToS (PRD §8.4): never scrape Zillow/Redfin/Trulia/Realtor — enforced by the denylist in both providers.

## Phase 3 — Email + deliverability  [PAID — small]
1. Buy a `.com` (~$10/yr) and send from a **subdomain** (e.g. `offers.yourbrand.com`).
2. SendGrid: 60-day trial → **Essentials $19.95/mo**. Authenticate the domain (SPF/DKIM/DMARC — free DNS records).
3. Set `EMAIL_PROVIDER=sendgrid`, `SENDGRID_*`, `MAILING_ADDRESS`, `UNSUBSCRIBE_BASE_URL`.
4. Point SendGrid **Inbound Parse** at `/api/inbound` so replies hit the gated intake loop.
5. **Warm up 2–4 weeks** before volume. → full steps in **`docs/DELIVERABILITY.md`**.

## Phase 4 — AI classification  [PAID — tiny]
Set `CLASSIFIER=anthropic` (+`ANTHROPIC_API_KEY`, a Haiku-class `ANTHROPIC_MODEL`). Classifying a few hundred reply emails/month is **cents**. Optional `PERSONALIZER=anthropic`.

## Phase 5 — ⛔ LEGAL GATE (required before any live send)  [PAID / EXTERNAL]
- Have a **Montana real-estate attorney review the assignment/purchase-agreement template** (the `intake` PDF). See **`docs/MONTANA-LEGAL.md`** for the exact statutes, the equitable-interest gray area, and what to ask.
- Only then flip `CONTRACT_TEMPLATE_REVIEWED=true` (removes the DRAFT stamp).
- This is **non-negotiable** (CLAUDE.md #5, PRD §8.3). Do not send live without it.

## Phase 6 — First campaign  [FREE / time]
1. Underwrite → only `verdict='clear'` owners are outreach-eligible.
2. Run `outreach` (email-first, ramped daily cap) — suppression + CAN-SPAM enforced.
3. Replies → `intake` classifies → on `interested`, a **queued** contract appears in the desk **Contracts queue**.
4. You **click Approve & send** (the human gate). Match the deal to your **top 3–5 buyers (24-hr window)**, then blast (deal page).
5. Buyer signs the assignment → collect the fee.

## Verify (any time, keyless)
```
pnpm install && pnpm -r typecheck && pnpm -r test && pnpm --filter @parcel/desk build
```

## What's free vs what costs
- **Free:** all the code, Supabase (dev), the county-records data path, SPF/DKIM/DMARC, warmup, the desk.
- **Unavoidably paid:** a sending plan (~$20/mo) + domain (~$10/yr), a tiny AI bill, **and the one-time MT attorney review** (the gate). A paid data provider is optional if you build the free county adapters.
