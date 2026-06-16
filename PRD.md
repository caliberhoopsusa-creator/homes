# PRD — Parcel: Automated Wholesale Acquisition Engine

**Owner:** Merk
**Status:** Draft v1 — ready for Claude Code build
**One line:** Source distressed properties in a radius, underwrite them, run a compliant high-deliverability outreach sequence, and drop every warm lead into the Parcel deal desk for assignment.

This file is the single source of truth for the build. It is written to be read by **multiple Claude Code agents working in parallel.** Read the whole thing once before touching code, then work only inside your assigned module and against the shared contract in §5.

---

## 1. The bet (read this first)

We make money on the **spread between a contract price and an end-buyer's ceiling** (the assignment fee). The defensible asset is not the listing data — anyone can rent that — it is (a) the **owned buyer list** and (b) the **speed and quality of the funnel** from raw address to signed assignment.

Three constraints are baked into every module below and are **non-negotiable**:

1. **Disposition is local.** End buyers are local flippers, landlords, and out-of-state private investors. Institutional / hedge-fund single-family buying is being federally restricted (Jan 2026 executive order + pending Sherman Act amendment) and was never active in Montana. Do not build for it.
2. **Contracts are trigger-gated, never blasted.** A purchase/assignment contract is generated and queued the moment a lead replies with intent — and sent by a one-click human action. We never auto-send a contract to a cold recipient. (Rationale: deliverability + conversion + MT broker-license exposure. See §8.)
3. **One operator, many deals.** The user is a single person. Automation exists to make one person move like a team, not to remove the human from the two moments that matter: approving an offer and approving a contract.

---

## 2. Goals / Non-goals

**Goals**
- Pull every candidate property in a user-defined radius and filter to deals that *clear the spread*.
- Enrich each candidate with owner contact info (skip-trace).
- Run a multi-touch, CAN-SPAM-compliant email sequence with high inbox placement.
- Detect and classify replies; auto-draft a contract on positive intent.
- Land every warm lead in the Parcel desk pipeline, matched to buyers.

**Non-goals (v1)**
- No MLS/IDX integration (license-gated; defer).
- No SMS/cold-calling automation (TCPA-heavy; defer to v2 behind explicit consent).
- No institutional-buyer disposition.
- No multi-tenant / multi-user accounts. Single operator only.

---

## 3. Success metrics

| Funnel stage | Target (v1) |
|---|---|
| Properties surfaced per radius pull | ≥ 500 |
| % that clear underwriting (fee ≥ target) | 5–15% |
| Skip-trace contact match rate | ≥ 60% |
| Email inbox placement (not spam) | ≥ 90% |
| Cold email reply rate | 2–5% |
| Positive-intent replies → contract sent | ≥ 40% |
| Time from reply → contract in queue | < 60 seconds |

---

## 4. System architecture

```
 ┌─────────────┐   ┌──────────────┐   ┌──────────────┐
 │  SOURCING   │──▶│  SKIP-TRACE  │──▶│ UNDERWRITING │
 │ radius pull │   │ owner lookup │   │  70% engine  │
 └─────────────┘   └──────────────┘   └──────┬───────┘
        (writes leads + properties)          │ only deals that CLEAR
                                             ▼
                                      ┌──────────────┐
                                      │  OUTREACH    │
                                      │ email seq +  │
                                      │ deliverability│
                                      └──────┬───────┘
                                             │ inbound replies
                                             ▼
                                      ┌──────────────┐
                                      │ REPLY INTAKE │
                                      │ intent class.│
                                      │ + contract   │
                                      │   gen (gated)│
                                      └──────┬───────┘
                                             │ warm lead + queued contract
                                             ▼
                                      ┌──────────────┐
                                      │ PARCEL DESK  │  ◀── buyer book
                                      │ Next.js app  │      + matching
                                      └──────────────┘
```

**Every box communicates through the database, not direct calls.** This is what lets the agents build in parallel: a service reads its input rows and writes its output rows. No service imports another service's internals.

**Stack (grounded in connected tools):**
- **DB + auth + storage:** Supabase (Postgres). Migrations are the source of truth; TS types are generated from the schema.
- **Backend services:** TypeScript (Node) — one folder per service, deployed as Supabase Edge Functions or a small worker process.
- **Email:** SendGrid (sending + Event Webhooks for opens/bounces + Inbound Parse for replies). Dedicated sending subdomain, not the primary domain.
- **Frontend / desktop:** Next.js (the Parcel desk). Package as a PWA for v1; wrap in Tauri for a true desktop binary in v2.
- **AI:** Anthropic API for reply intent classification and email personalization.

---

## 5. The shared data contract (THE KEYSTONE)

**Build this first. Nothing else starts until this migration is merged.** Every agent codes against these tables and the generated types. Changes to this schema require a PR that all agents review.

```sql
-- properties: the raw asset
create table properties (
  id uuid primary key default gen_random_uuid(),
  source text not null,                 -- 'attom' | 'batchdata' | 'manual'
  source_id text,
  address text not null,
  city text, state text, zip text,
  lat double precision, lng double precision,
  beds int, baths numeric, sqft int, year_built int,
  est_value numeric,                    -- provider AVM
  asking numeric,                       -- if listed/known
  distress_signals text[],              -- ['tax_delinquent','preforeclosure','vacant','absentee']
  created_at timestamptz default now(),
  unique (source, source_id)
);

-- owners: who we actually email (a house can't read)
create table owners (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references properties(id) on delete cascade,
  full_name text,
  email text, phone text, mailing_address text,
  skiptrace_status text default 'pending', -- pending|matched|none
  skiptrace_confidence numeric,
  created_at timestamptz default now()
);

-- underwrites: the 70% math, one row per property
create table underwrites (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references properties(id) on delete cascade,
  arv numeric, repairs numeric,
  rule_pct numeric default 0.70, fee_target numeric default 12000,
  buyer_ceiling numeric,                -- arv*rule_pct - repairs
  your_mao numeric,                     -- buyer_ceiling - fee_target
  fee_potential numeric,                -- buyer_ceiling - asking
  verdict text,                         -- 'clear' | 'thin' | 'pass'
  created_at timestamptz default now()
);

-- campaigns + messages: the outreach layer
create table campaigns (
  id uuid primary key default gen_random_uuid(),
  name text, status text default 'active',
  from_domain text, daily_cap int default 50,
  created_at timestamptz default now()
);
create table messages (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id),
  owner_id uuid references owners(id) on delete cascade,
  step int default 1,                   -- which touch in the sequence
  direction text default 'outbound',    -- outbound | inbound
  subject text, body text,
  status text,                          -- queued|sent|delivered|opened|bounced|replied|unsubscribed
  provider_id text,
  sent_at timestamptz, created_at timestamptz default now()
);

-- replies → intent → gated contract
create table replies (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references messages(id),
  owner_id uuid references owners(id),
  raw_text text,
  intent text,                          -- 'interested'|'maybe'|'not_now'|'do_not_contact'|'unknown'
  intent_confidence numeric,
  created_at timestamptz default now()
);
create table contracts (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references properties(id),
  owner_id uuid references owners(id),
  offer_price numeric,
  pdf_url text,
  status text default 'queued',         -- queued|approved|sent|signed|void
  created_at timestamptz default now()
);

-- the desk: deals + buyers + matches (Parcel frontend reads these)
create table deals (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references properties(id),
  stage text default 'Lead',            -- Lead|Contacted|Under contract|Assigned|Closed
  notes text, created_at timestamptz default now()
);
create table buyers (
  id uuid primary key default gen_random_uuid(),
  name text, type text,
  min_price numeric, max_price numeric, min_beds int,
  areas text[], max_repairs numeric, notes text,
  created_at timestamptz default now()
);
create table matches (
  deal_id uuid references deals(id) on delete cascade,
  buyer_id uuid references buyers(id) on delete cascade,
  score int, qualifies boolean,
  primary key (deal_id, buyer_id)
);
```

After migration, run Supabase type generation and commit `packages/types/database.types.ts`. **Every service imports from there.**

---

## 6. Module specs

Each is an independent workstream. Format: purpose · in → out · key reqs · done-when.

### 6.1 Sourcing service  `services/sourcing`
- **Purpose:** given a center point + radius + filters, fetch candidate properties and write `properties` rows.
- **In → out:** `{lat, lng, radiusMiles, filters}` → N `properties` rows (deduped on `source+source_id`).
- **Key reqs:** integrate one data provider (ATTOM Data or BatchData API — pick one, abstract behind a `PropertyProvider` interface so the other can be swapped). Geocode, dedupe, tag `distress_signals`. Rate-limit and cache.
- **Done when:** a radius pull around Billings writes ≥ 500 deduped rows with distress tags and no provider key in source control.

### 6.2 Skip-trace service  `services/skiptrace`
- **Purpose:** resolve owner contact info for properties missing it.
- **In → out:** `properties` rows where no matched `owner` → `owners` rows with email/phone + confidence.
- **Key reqs:** BatchData / skip-trace API behind a `SkipTraceProvider` interface. Never overwrite a higher-confidence match. Respect provider ToS.
- **Done when:** ≥ 60% of input properties get a `matched` owner with an email.

### 6.3 Underwriting engine  `services/underwriting`
- **Purpose:** run the wholesaler 70% rule on each property; write `underwrites`.
- **In → out:** `properties` (+ ARV/repair estimates) → one `underwrites` row each.
- **Key reqs:** pure, fully unit-tested logic (no external deps — **this agent can start the instant the schema lands**). `buyer_ceiling = arv*rule_pct - repairs`; `your_mao = buyer_ceiling - fee_target`; `fee_potential = buyer_ceiling - asking`. Verdict: `clear` if `fee_potential ≥ fee_target`, `thin` if `> 0`, else `pass`. ARV/repairs default to provider AVM × heuristic until a comps source is added (flag as estimate).
- **Done when:** matches the Parcel desk math exactly (port the existing `underwrite()` function), 100% test coverage on the math.

### 6.4 Outreach engine  `services/outreach`
- **Purpose:** run the compliant, high-deliverability email sequence against owners attached to *clearing* deals only.
- **In → out:** `owners` of `verdict='clear'` properties → `messages` rows + real sends via SendGrid.
- **Key reqs:**
  - **Deliverability:** dedicated sending subdomain (e.g. `offers.yourbrand.com`), SPF + DKIM + DMARC, 2–4 week warmup, hard daily cap with ramp. Plain-text-feel HTML, no images/links in touch 1.
  - **Sequence:** 3 touches (day 0 / 3 / 7), one CTA each: *"Would you consider a cash offer on [address]?"* Reply-to a monitored inbox.
  - **Compliance (CAN-SPAM, hard requirements):** truthful subject + from, physical mailing address in footer, working one-click unsubscribe, honor opt-outs within 10 days, suppress `do_not_contact` permanently.
  - **Personalization:** Anthropic API fills 1–2 real tokens (address, neighborhood) — never fake familiarity.
- **Done when:** a test campaign sends, logs every status via SendGrid Event Webhook, and a seeded `do_not_contact` owner is never messaged.

### 6.5 Reply intake + contract gen  `services/intake`
- **Purpose:** ingest replies, classify intent, and **gate** contract generation.
- **In → out:** SendGrid Inbound Parse webhook → `replies` row → on `interested`: a `contracts` row (`status='queued'`) + a `deals` row at stage `Contacted`.
- **Key reqs:**
  - Inbound Parse handler writes `replies` and links to the `messages`/`owner`.
  - Anthropic API classifies intent into the enum with confidence.
  - **Contract is generated but NOT sent.** Fill an **attorney-reviewed** assignment-ready purchase-agreement template (variables: parties, address, offer price = `your_mao`, terms) → render PDF → Supabase storage → `contracts.pdf_url`, `status='queued'`. A human approves in the desk, which flips to `approved` → `sent`.
  - `do_not_contact` / unsubscribe intents write suppression + never create a contract.
- **Done when:** a simulated "yes I'd take an offer" reply produces a queued contract PDF and a desk deal in < 60s, and a "remove me" reply suppresses the owner.

### 6.6 Parcel desk  `apps/desk` (Next.js)
- **Purpose:** the operator's cockpit. Port the existing Parcel artifact onto Supabase.
- **In → out:** reads `deals/properties/underwrites/buyers/matches/contracts`; writes `buyers`, stage changes, contract approvals.
- **Key reqs:** pipeline board (Lead→Closed), per-deal underwriting + spread bar, buyer buy-box CRUD, live buyer-matching (port `matchScore()`), a **Contracts queue** with one-click *Approve & send*, and a radius-pull trigger button. Realtime via Supabase subscriptions so warm leads appear without refresh.
- **Done when:** the existing UI runs against live data, a queued contract can be approved and sent, and buyer matches render per deal.

---

## 7. Multi-agent orchestration (Claude Code)

The whole point: **N agents, near-zero collisions, maximum throughput.** Achieved by (a) contracts-first, (b) DB-decoupling, (c) one git worktree per agent, (d) a tight definition-of-done so no agent gold-plates.

### 7.1 Repo layout (monorepo)
```
/packages/types        ← generated Supabase types + shared zod schemas  (shared, read-mostly)
/supabase/migrations   ← the schema (Phase 0 owns this)
/services/sourcing
/services/skiptrace
/services/underwriting
/services/outreach
/services/intake
/apps/desk
/CLAUDE.md             ← global rules; each service also has its own CLAUDE.md
```

### 7.2 Worktrees, one per agent
Run each agent in an isolated worktree so they never touch the same files at once:
```bash
git worktree add ../parcel-sourcing    -b feat/sourcing
git worktree add ../parcel-underwriting -b feat/underwriting
git worktree add ../parcel-outreach    -b feat/outreach
git worktree add ../parcel-intake      -b feat/intake
git worktree add ../parcel-desk        -b feat/desk
```
Open one Claude Code session per worktree. Each session's working directory *is* its module. A per-module `CLAUDE.md` tells that agent: "you own `services/X`, you import from `packages/types`, you never edit another service."

### 7.3 The dependency graph (what blocks what)

| Wave | Agent / worktree | Module | Depends on | Parallel with |
|---|---|---|---|---|
| **0** | Schema agent | `supabase/migrations` + `packages/types` | — | nobody (everyone waits) |
| **1** | A | sourcing | Wave 0 | B, C-prep, E |
| **1** | B | underwriting | Wave 0 only | A, C-prep, E (fully independent — pure logic) |
| **1** | E | desk (UI shell on live schema) | Wave 0 | A, B |
| **1** | C | outreach (build against seeded rows) | Wave 0 | A, B, E |
| **2** | D | intake + contract gen | C's `messages` shape | (runs as C stabilizes) |
| **2** | A→ | skip-trace (extends sourcing) | A | D |

Only **Wave 0 is a true blocker.** After it merges, A/B/C/E start simultaneously. C and D communicate through `messages`/`replies` rows, so C can be built and tested against seeded fixtures before D exists, and vice-versa. This is why the schema must be perfect before anyone writes a service.

### 7.4 Efficiency rules (put in global CLAUDE.md)
- Import types only from `packages/types`. Never redefine a shared shape.
- A service talks to other services **only** through Postgres tables in §5.
- Each module ships with its own tests and a 5-line README of its contract. Definition-of-done is the "done when" line in §6 — do not exceed scope.
- No secrets in source. All keys via env. Provider integrations sit behind the named interfaces so they're swappable and mockable.
- Open a PR per module against `main`; the schema is the only file requiring all-agent review.

---

## 8. Compliance & risk guardrails (non-negotiable)

These are requirements, not suggestions. Any agent that finds itself working around one should stop and flag it.

1. **No cold contracts.** Contracts generate on positive-intent reply only, and send on explicit human approval (§6.5). Auto-blasting contracts to homeowners is the fastest path to a spam blacklist *and* to being treated as an unlicensed broker under MT law.
2. **CAN-SPAM on every send:** accurate headers, physical address, functioning unsubscribe, opt-outs honored ≤ 10 days, permanent suppression list.
3. **Montana broker-license line:** wholesaling is assigning *your equitable interest*, not marketing the property. The system markets *an offer to buy*, never *the property for sale*. Repetitive volume can trigger broker scrutiny — surface a deal-count metric so the operator can pace, and **the assignment-agreement template must be reviewed by a Montana RE attorney before the first live send.**
4. **Skip-trace + data ToS:** use providers within their terms; no scraping Zillow/Redfin (ToS + legal risk). 
5. **PII handling:** owner contact data is sensitive — RLS on Supabase, no PII in logs.

---

## 9. Build phases

- **Phase 0 — Contract (1 agent, ~½ day):** schema migration + generated types. Blocks everything.
- **Phase 1 — Parallel core (4–5 agents):** sourcing, underwriting, outreach (against fixtures), desk shell. 
- **Phase 2 — Close the loop (2 agents):** skip-trace, intake + gated contract gen, desk Contracts queue.
- **Phase 3 — Deliverability hardening:** domain warmup, DMARC, send-rate ramp, inbox-placement testing.
- **Phase 4 — Desktop:** wrap `apps/desk` in Tauri for a signed desktop binary.

---

## 10. Open questions (resolve before Phase 1)

1. **Data provider:** ATTOM vs BatchData for sourcing + skip-trace? (Affects 6.1/6.2 — pick one to start.)
2. **Sending domain:** which subdomain, and is warmup starting now? (3-week lead time gates real outreach.)
3. **Contract template:** who's the Montana RE attorney reviewing the assignment agreement? (Hard gate on first live send.)
4. **ARV/repairs source:** provider AVM heuristic for v1, or wire a comps API immediately?
