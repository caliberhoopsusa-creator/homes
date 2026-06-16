# Parcel — Session Log & Project State

> **Purpose:** the running brain for this repo. Read this + `PRD.md` + root `CLAUDE.md`
> at the start of any session to know the platform as well as the person who built it.
> Append a new dated entry at the **end of every session** capturing what changed.
> `PRD.md` is the source of truth for *intent*; this file is the truth for *current state*.

---

## 0. TL;DR current state (as of 2026-06-16)

A pnpm/TypeScript monorepo implementing the Parcel wholesale-acquisition funnel.
**Every stage is built and green, runnable end-to-end locally with ZERO API keys**
(all providers default to mocks). Going live = drop real keys behind the existing
interfaces + provision Supabase.

- **8 workspace projects** typecheck clean; **80 tests pass** (underwriting 15, sourcing 17,
  skiptrace 12, outreach 22, intake 14); the Next.js desk builds.
- Funnel: `sourcing → skiptrace → underwriting → outreach → intake (gated contract) → desk`.
- Verify everything: `pnpm install && pnpm -r typecheck && pnpm -r test && pnpm --filter @parcel/desk build`.
- **Domain knowledge:** `docs/RESEARCH-wholesaling.md` is the pro playbook (deep research). Build-affecting
  highlights: plan assignment fee **~$10k** (reconsider `fee_target` $12k→$10k); funnel **~66 leads →
  ~10–15 offers → 1 deal**, cost/deal **$4–9k**; stay **email-first** (CAN-SPAM stable; TCPA/SMS/calls =
  litigation minefield); no Zillow/Redfin scraping; dispo = top 3–5 matched buyers, 24-hr window, then blast;
  buyer list from county cash-closings; Montana law still needs an attorney check.

---

## 1. What this is

Automated wholesale real-estate acquisition engine. Source distressed properties in a
radius → underwrite (70% rule) → compliant email outreach → classify replies →
**gated** contract generation → warm leads land in an operator "desk".
**Money model:** the assignment-fee spread. **Goal:** ~$10k/month ≈ one $12k assignment/month.

---

## 2. Repo layout

```
PRD.md                 source of truth (read if unsure)
CLAUDE.md              global rules (read every session)
docs/SESSION-LOG.md    THIS FILE — state + per-session changelog
.env.example           every provider key (all default to mock)
packages/types         @parcel/types — shared TS types + zod schemas (THE KEYSTONE)
packages/db            @parcel/db — Supabase client + Postgres impls of each store iface
supabase/migrations    0001_init.sql — the §5 schema (source of truth for tables)
services/sourcing      @parcel/sourcing   radius pull → properties
services/skiptrace     @parcel/skiptrace  properties → owners (contact)
services/underwriting  @parcel/underwriting  pure 70% math → underwrites
services/outreach      @parcel/outreach   clearing owners → messages (email seq)
services/intake        @parcel/intake     replies → intent → gated contract
apps/desk              @parcel/desk       Next.js operator cockpit
```

**Architecture rule (non-negotiable):** services talk to each other ONLY through the
Postgres tables. No service imports another service's internals. DB access inside a
service is via an **injected store interface** (no DB client in services). The concrete
Postgres stores live in `packages/db` (the composition/wiring layer — allowed to depend
on service interface types).

---

## 3. The keystone (`packages/types` + `supabase/migrations`)

- `supabase/migrations/0001_init.sql`: tables from PRD §5 — `properties, owners,
  underwrites, campaigns, messages, replies, contracts, deals, buyers, matches` + a
  `suppressions` table (CAN-SPAM) + RLS enabled + indexes. Added `underwrites.is_estimate`.
- `packages/types/src/database.types.ts`: hand-maintained row + `*Insert` types mirroring
  the schema (no live Supabase yet, so types are hand-written, not generated).
- `packages/types/src/schemas.ts`: shared zod schemas — `propertyCandidate`, `ownerHit`,
  `underwriteInput`, `radiusPullRequest`, enums.
- **Any change here requires re-checking every consumer.** Done so far: added `firecrawl`
  to `PropertySource` + the `propertyCandidate` source enum.

---

## 4. Module-by-module

### services/underwriting (`@parcel/underwriting`) — DONE, 100% on the math
- `underwrite()` PURE 70% math: `buyer_ceiling = arv*rule_pct - repairs`,
  `your_mao = buyer_ceiling - fee_target`, `fee_potential = buyer_ceiling - asking`.
  Verdict: `clear` if fee ≥ target, `thin` if > 0, else `pass`.
- `estimateInputs()` v1 AVM×per-sqft heuristic (flags `is_estimate`).
- `runUnderwriting(store)` writes one `underwrites` row per un-underwritten property.
- **The desk imports `underwrite()` from here** so the spread bar can't drift.

### services/sourcing (`@parcel/sourcing`) — DONE
- `PropertyProvider.search(req)`. Impls: `MockProvider` (deterministic, ≥500 Billings rows),
  `BatchDataProvider`, `FirecrawlProvider`. Factory on `PROPERTY_PROVIDER` (mock|batchdata|firecrawl),
  wrapped in a TTL cache/rate-limit layer.
- `runPull(provider, store, req)` normalizes→zod-validates→radius-filters→dedupes on
  `source+source_id`→inserts via `SourcingStore`.

### services/skiptrace (`@parcel/skiptrace`) — DONE
- `SkipTraceProvider.trace(property) → OwnerHit | null`. Impls: Mock (~70–80% match),
  BatchData, Firecrawl. Factory shares `PROPERTY_PROVIDER`.
- `runSkiptrace(provider, store)` — **never downgrades** a higher-confidence existing owner;
  sets `skiptrace_status` matched/none.

### services/outreach (`@parcel/outreach`) — DONE
- `EmailProvider` (Mock | SendGrid v3). `Personalizer` (Mock | Anthropic) — fills only real
  tokens (address, neighborhood). 3-touch sequence (day 0/3/7), one CTA, touch 1 link/image-free.
- **CAN-SPAM hard gate:** every body carries physical mailing address + per-owner one-click
  unsubscribe token (`isCompliant` throws otherwise). Suppression checked before any send.
- `runCampaign(deps, opts)` ramped daily cap; logs `messages` queued→sent via `OutreachStore`.

### services/intake (`@parcel/intake`) — DONE (Phase 2, the revenue gate)
- `parseInboundParse(fields)` normalizes a SendGrid Inbound Parse payload.
- `IntentClassifier` (Mock keyword | Anthropic). `CLASSIFIER` selects.
- `handleInboundReply(email, deps)` writes a `replies` row then **GATES**:
  - `interested` → render assignable-purchase-agreement PDF (offer = `your_mao`) via a
    dependency-free PDF writer → upload via `ContractStorage` (Mock | Supabase) → insert
    `contracts` row **`status='queued'` (NEVER sent)** + `deals` row at `Contacted`.
  - `do_not_contact` → permanent `suppressions` row, no contract.
  - `maybe/not_now/unknown` → reply recorded only.
- Template stamped **DRAFT — pending MT attorney review** until `CONTRACT_TEMPLATE_REVIEWED=true`.

### apps/desk (`@parcel/desk`) — DONE (Next 15 App Router, Tailwind)
- Pages: pipeline board (Lead→Closed), deal detail w/ spread bar (uses `underwrite()`),
  buyers buy-box CRUD, `matchScore()` ranking, **Contracts queue** w/ one-click *Approve &
  send* (the human gate; never auto-sends), `$10k/month` pace dashboard + deal-count.
- `lib/data.ts` single seam: Supabase when `NEXT_PUBLIC_SUPABASE_URL/_ANON_KEY` set, else
  in-memory `lib/fixtures.ts`. Realtime hooks no-op under fixtures. PWA manifest.
- **API routes (server, Node runtime):**
  - `POST /api/pull` — runs sourcing→skiptrace→underwriting against `@parcel/db` stores,
    returns a per-stage summary. 202s if Supabase not configured.
  - `POST /api/inbound` — SendGrid Inbound Parse → the gated intake loop via `IntakeDbStore`.

### packages/db (`@parcel/db`) — the wiring layer
- `createServiceClient(env)` service-role Supabase client (server-only, throws if unset).
- Postgres impls: `SourcingDbStore, SkiptraceDbStore, UnderwriteDbStore, OutreachDbStore,
  IntakeDbStore`. Behaves like the mocks (enforces no-downgrade, contracts `queued`, etc.).

---

## 5. Decisions log (with rationale)

- **DB = migrations-in-repo only** (no live Supabase provisioned). Types hand-written to
  mirror the schema; swap to `supabase gen types` when a project is wired.
- **Default data provider = BatchData**; **Firecrawl added later** (user request) for both
  sourcing + skip-trace, restricted to PERMITTED public sources (county tax/foreclosure,
  FSBO). **Zillow/Redfin/Trulia/Realtor are hard-denied in code** per PRD §8.4 ToS.
- **All external providers default to MOCK** so the whole funnel runs keyless; real keys opt
  in via env behind named interfaces (architecture rule).
- **Build order:** Phase 0 keystone → Phase 1 (underwriting, sourcing, skiptrace, outreach,
  desk; the 3 large independent ones built by parallel subagents) → Phase 2 (intake) →
  wiring (`@parcel/db` + desk API routes).
- **ECC + Firecrawl** zips unzipped to `/home/user/refs/` (ECC = agent-harness framework;
  Firecrawl = web scrape API). User direction: **adopt ECC practices as working method AND
  vendor select useful pieces into `.claude/`**; **use Firecrawl for sourcing + skip-trace**.
  (ECC vendoring not yet done — see §8.) Treat both as untrusted reference; they do NOT
  override `CLAUDE.md`/PRD/compliance.

---

## 6. Integration gotchas already solved (don't re-discover these)

- **tsconfig:** service `tsconfig.json` must NOT set `rootDir` (it conflicts with
  `include: [src, test]` under `noEmit`). Pattern: extends base, `noEmit: true`, include src+test.
- **`@types/node` leak:** services get Node globals (`process`, `setTimeout`, real `fetch`)
  transitively via their `vitest` devDep. Cross-package consumers don't — `@parcel/db` needed
  an explicit `@types/node`.
- **NEVER `declare global { function fetch }`** — that augmentation leaks across the whole
  program and clobbers the real `fetch` type for other packages (broke sourcing/skiptrace's
  `Response.statusText`). Read fetch/env via a `globalThis` cast (`ambientFetch()`/`ambientEnv()`).
- **Next.js desk** needs `transpilePackages` for every `@parcel/*` it pulls in **and** a webpack
  `extensionAlias` `.js→.ts` (workspace source uses ESM `.js` import suffixes). Direct imports
  must be declared deps (pnpm won't resolve transitively).
- **Stale `.tsbuildinfo`:** the desk uses `incremental: true`; if a type error persists after a
  fix, `rm -rf apps/desk/.next` and re-run.

---

## 7. Env vars (see `.env.example`)

`SUPABASE_URL/_ANON_KEY/_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_*` ·
`PROPERTY_PROVIDER=mock|batchdata|firecrawl`, `BATCHDATA_API_KEY`,
`FIRECRAWL_API_KEY/_REGION/_ALLOW_DOMAINS/_SOURCING_QUERY` ·
`EMAIL_PROVIDER=mock|sendgrid`, `SENDGRID_*`, `MAILING_ADDRESS`, `UNSUBSCRIBE_BASE_URL` ·
`PERSONALIZER`/`CLASSIFIER=mock|anthropic`, `ANTHROPIC_API_KEY/_MODEL` ·
`CONTRACT_STORAGE=mock|supabase`, `CONTRACTS_BUCKET`, `CONTRACT_TEMPLATE_REVIEWED=false`.

---

## 8. What remains (to go live)

1. **Provision Supabase**, apply `0001_init.sql`, set keys; switch `lib/data.ts` to live.
2. Drop real provider keys (BatchData/Firecrawl, SendGrid, Anthropic).
3. **Montana RE attorney reviews the assignment template**, then `CONTRACT_TEMPLATE_REVIEWED=true`.
4. Deliverability hardening (subdomain warmup, SPF/DKIM/DMARC). Then Tauri desktop wrap (v2).
5. **ECC vendoring** into `.claude/` (per user): a SessionStart hook (install + typecheck/test),
   plus distilled review/testing rules — author them, don't blind-copy third-party scripts.
6. (Reconcile BatchData/Firecrawl request/response field paths against live API specs before
   the first real call — mappings are faithful but untested live.)

---

## 9. Conventions for any new module

`@parcel/<name>`, `"type":"module"`, ESM `.js` import suffixes, tsconfig extends base
(`noEmit`, no `rootDir`), Vitest. External deps behind a named interface with a Mock default +
real impl reading keys from env (throws if missing). DB via an injected store interface.
Ship a 5-line README + a tight CLAUDE.md. Stay within the PRD §6 "done when" — don't gold-plate.

---

## 10. Per-session changelog

### Session 1 — 2026-06-16 (greenfield → full funnel + wiring + Firecrawl)
- Built Phase 0 keystone, Phase 1 (underwriting, sourcing, skiptrace, outreach, desk),
  Phase 2 (intake gated contracts), the `@parcel/db` wiring layer, and both desk API routes
  (`/api/pull`, `/api/inbound`). Made the radius-pull button real.
- Added Firecrawl providers for sourcing + skip-trace (keystone `firecrawl` source) with ToS denylist.
- Unzipped ECC + Firecrawl reference repos to `/home/user/refs/`.
- Solved the integration gotchas in §6. Final state: 8/8 typecheck, 80 tests, desk builds.
- Commits: `9ea4cc2` (keystone) → `87b12e7` (underwriting) → `026e0de`/`4a1e426` (sourcing+skiptrace)
  → `f6c3d21` (outreach) → desk+fixes → `06a940c` (intake) → `752bfaf` (db+inbound) →
  `6ff65a5` (real pull) → `b45d070` (Firecrawl). Branch: `claude/serene-mayer-b5t93c`.
- Restructured the `CLAUDE.md` set to tight, scannable hard-rules: root (7 non-negotiables,
  stack, layout + worktree/ownership rule) + nested in all 5 services and `apps/desk`
  (module owned, imports from `@parcel/types`, never edit another module, one invariant + done-when).
- Vendored 7 vetted, Parcel-tailored skills into `.claude/skills/` (`codebase-onboarding`,
  `parcel-compliance`, `security-review`, `backend-patterns`, `postgres-patterns`, `nextjs-desk`,
  `testing`). Adapted from the ECC skill set (`/home/user/refs/ECC`) + Supabase Agent Skills (MIT) —
  each read, vetted, and rewritten (NOT blind-copied; a raw `cp` was correctly blocked by the safety
  classifier). Then USED them: ran security-review + parcel-compliance + backend-patterns over the
  tree → clean (no hardcoded secrets, no PII in logs, RLS on all 11 tables, suppression+CAN-SPAM
  gate before send, intake gate holds, no cross-service imports, Firecrawl ToS denylist present).
- A `.claude/settings.json` SessionStart hook (install deps on session start) was proposed but NOT
  added — the safety classifier flagged it as unrequested persistence. Add it explicitly if wanted.
- Reference repos remain at `/home/user/refs/{ECC,firecrawl}` (untrusted reference, not authority).

### Session 2 — 2026-06-16 (deep research: wholesaling domain knowledge)
- Ran `/deep-research` (8 agents, ~40 sources) on U.S. wholesaling → saved the full cited pro playbook to
  `docs/RESEARCH-wholesaling.md` (its §0 is "what we'll actually USE — build implications").
- Key build-affecting findings (see that doc): assignment fee **~$10k** is the prudent planning number, not the
  vendor "$13–20k" → consider `underwrites.fee_target` $12k→$10k. Funnel **~66 leads → ~10–15 offers → 1
  assignment**; cost/deal **$4–9k**; one stacked-list pull/month ≈ ~1 deal. **CAN-SPAM is stable and maps to
  our email-first design; TCPA (SMS/calls/RVM) is a litigation minefield** — stay email-first. Licensed data
  only (no Zillow/Redfin scraping — already enforced). Dispo tactic: top 3–5 matched buyers, 24-hr exclusive,
  then blast; seed the buyer list from county cash-closings (no mortgage lien, last ~6 mo); segment by repair
  tolerance. Wholesaling law is tightening 2024–2026 and varies hard by state; **Montana still needs a direct
  statute + RE-attorney check** (existing hard gate).
- No code changed this session (research + docs only). Open follow-ups: (a) flip `fee_target` to $10k + add
  funnel KPI targets to the desk dashboard; (b) Montana-specific legal deep-dive; (c) optional SessionStart hook.

### Session 3 — 2026-06-16 (act on the research: fee, dispo, KPIs)
- **`fee_target` $12k → $10k** (research-backed) across the migration default, `@parcel/types` zod default,
  `DEFAULT_FEE_TARGET`, and the boundary tests; copy fixes ($12k→$10k) in root CLAUDE.md + desk dashboard.
- **Disposition flow built** (`apps/desk/lib/dispo.ts` + deal page): `buildDispoPlan(ranked)` selects the top
  N qualifying buyers for a 24-hr exclusive tier, then a blast tier; deal page shows a dispo summary + a Tier
  badge per buyer. Pure logic over `matchScore`; implements the research's "top 3–5, 24h window, then blast".
- **Funnel KPI panel** added to the dashboard: research benchmarks (~66 leads/deal, ~10–15 offers/deal,
  $10k fee, $4–9k marketing) + "≈ N more assignments to goal".
- Verified: 8/8 typecheck, 80 tests (underwriting still 100% on the math), desk builds.
- Still open / NOT free: provision Supabase (free tier) + real data-provider key (paid, or build free
  county-records ingesters) + SendGrid (free tier) + domain + **attorney-reviewed contract / MT legal check**
  (the one true hard gate). A `docs/GO-LIVE.md` checklist (free vs paid, ordered) is the next doc to write.

### Session 4 — 2026-06-16 (go-live: free build + payment-block research)
- Orchestrated a lead deep-research agent + per-block sub-agents on the "payment blocks" (cheapest stack,
  deliverability, Montana legal). Persisted findings to **`docs/GO-LIVE.md`** (ordered free-vs-paid runbook),
  **`docs/DELIVERABILITY.md`** (SPF/DKIM/DMARC + Google/Yahoo 2024 rules + warmup ramp), **`docs/MONTANA-LEGAL.md`**.
- **Built the FREE data path:** `CountyRecordsProvider` (`PROPERTY_PROVIDER=county`) — pulls public county
  records (normalized JSON per source, `COUNTY_RECORDS_SOURCES`) with the ToS denylist. Keystone: added
  `county` to `PropertySource` + zod enum. Also **fixed a latent bug**: `runPull` dropped null-coord
  candidates (radius filter), so county/Firecrawl results were silently discarded — now kept. 89 tests.
- **Key research takeaways:** MT has **no wholesaling statute** (legal via equitable-interest assignment; the
  risk is the unlicensed-broker line, MCA 37-51-102/103/301; equitable-interest ≠ "owner" is the gray area →
  **attorney review still required**, double-close is the safest structure). SendGrid free tier **retired May
  2025** → ~$20/mo Essentials + ~$10/yr domain; SPF/DKIM/DMARC + warmup are free. **Cheapest viable stack ≈
  $20/mo + $10/yr** using the free county data path + Supabase free tier; AI is ~$1–5/mo.
- GitHub: filed issues #1–#4 (#1 Go-Live, #2 deliverability **fulfilled by the new docs**; #3 county provider
  **built**; #4 live-Supabase still blocked on external infra). Copilot auto-assign unavailable via this MCP.
- **Closed two real free gaps:** (1) working **one-click unsubscribe** — `apps/desk/app/api/unsubscribe`
  (GET + RFC 8058 POST) decodes the per-owner token → `suppressOwnerById` writes a `suppressions` row (the
  link in every email was previously dead = CAN-SPAM violation). (2) **buyer-list from county cash-closings** —
  `apps/desk/lib/buyers-import.ts` (`inferBuyersFromCashSales`) + `/api/buyers/import` + `@parcel/db insertBuyers`,
  building the dispo moat from public deed records.
- **Added Vitest to the desk** (its pure logic had zero tests): dispo, matchScore, buyers-import — 8 tests.
- Verified: 8/8 typecheck, **97 tests** (89 services + 8 desk), desk builds.
