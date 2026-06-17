# Parcel — Automation Plan (Max Maxwell masterclass → automated system)

> **Context.** Max Maxwell's "Wholesaling Fundamentals" masterclass is the manual playbook;
> Parcel is the machine that automates it. This plan closes the four gaps between his manual
> process and Parcel's current automation, **without crossing any compliance line** (PRD +
> root CLAUDE.md hard rules). Source of intent: `PRD.md`. Current state: `docs/SESSION-LOG.md`.
> Domain research already captured: `docs/RESEARCH-wholesaling.md`.

## Compliance invariants (must hold after every phase)
- **No cold contracts** — contract only on positive-intent reply; **sent only by human click**.
- **No live sends until** `CONTRACT_TEMPLATE_REVIEWED=true` (MT attorney review — still `false`).
- **CAN-SPAM on every send**, incl. the new buyer-blast emails (physical address + one-click
  unsubscribe + suppression check, reusing the existing outreach compliant-send path).
- **Email-first** — Max leans on cold-calling/SMS; we deliberately do **not** automate those (TCPA).
- **Market an offer to buy, not the property** (MT broker line) in all buyer/seller copy.
- Services talk only via Postgres tables; shared types only from `@parcel/types`.

## Pre-step (blocks Gap 1 accuracy)
The live `homes` DB currently holds **829 synthetic `source='manual'` rows** from a mock pull
(real deals are `source='county'`). These would poison the comps engine. **Delete them first**
(`source='manual' AND created_at::date=current_date`, cascade owners/underwrites). Decide whether
to keep/revert the 44 Cooper St demo assignment.

---

## Gap 1 — Comps/ARV + repair engine  (`services/underwriting`, `services/sourcing`)
**Why:** Max's two biggest modules. Today `estimateInputs()` is an AVM×per-sqft heuristic; ARV is
the foundation — wrong ARV breaks everything downstream.

- `services/underwriting/src/comps.ts` (pure):
  - `selectComps(subject, candidates)` — filter by distance ≤1mi (haversine), sold ≤6mo, sqft ±20%,
    beds ±1, similar condition; return top 3–5.
  - `estimateArvFromComps(subject, comps, adjustments)` — per-feature $ adjustments (bed/bath/sqft/
    garage/pool, market-configurable), then average adjusted $/sqft × subject sqft. Max's method.
- `services/underwriting/src/repairs.ts` (pure):
  - `estimateRepairs(sqft, condition, ranges)` — condition tiers light/med/heavy → $/sqft
    (≈$15/$25/$40 per his numbers) + big-ticket adders (roof/HVAC/foundation). Returns
    `{ total, breakdown }` (breakdown feeds Gap 2's deal package).
- `estimateInputs()` gains a comps path (uses real comps when available → `is_estimate=false`;
  falls back to heuristic → `is_estimate=true`).
- **Comps data:** add a `SoldCompsProvider` interface in `services/sourcing` (Mock default; County
  sold-records impl) so the engine stays keyless-runnable. No live API key required to ship.
- **Tests:** comp selection/adjustment, repair tiers, end-to-end ARV→MAO.

## Gap 2 — Buyer deal-package PDF + blast emails  (`apps/desk`, `services/outreach`)
**Why:** Max's "CMA deal package" is how deals get sold fast; today `dispatchToBuyers` only records
`sent_at` — it never emails anyone.

- `apps/desk/lib/deal-package.ts` `buildDealPackage(...)` — reuses the dependency-free PDF renderer
  already in `@parcel/intake`; contents per Max: property overview + photos, comps table +
  adjustments, itemized repairs, ARV, buyer profit, assignment fee, timeline.
- `GET /api/deals/[id]/package` — regenerates on demand (mirrors the contract-PDF route).
- `dispatchToBuyers(dealId, tier)` — for each buyer in the tier, queue a **CAN-SPAM-compliant**
  email (via outreach `runCampaign`/EmailProvider, mock until SendGrid) with the package link, then
  stamp `sent_at`. Suppression + unsubscribe enforced. Exclusive (24h) then blast, per Max.
- **Tests:** package builder, dispatch-sends-and-records, suppression honored.

## Gap 3 — Itemized MAO + 6-touch seller drip  (`packages/types`, `services/underwriting`, `services/outreach`)
**Why:** Max's full MAO is itemized; his seller follow-up is 6 touches over 30 days vs our 3.

- **Keystone:** add optional `holding_costs`, `closing_costs`, `buyer_profit_pct` (default 0.15) to
  `underwriteInput` (zod) + `underwrites` (migration + `database.types.ts`).
- `underwrite()` — when itemized fields present:
  `your_mao = arv − repairs − holding − closing − arv*buyer_profit_pct − fee_target`;
  else keep the 70% rule (default). **Re-check every consumer** (SpreadBar, deal page, intake
  offer calc) — keystone change.
- `services/outreach` — extend sequence 3→6 touches (day 0/3/7/14/21/30), one CTA each, touch-1
  link/image-free (existing rule); ramped daily cap unchanged.
- **Tests:** itemized vs 70% MAO boundaries; 6-touch schedule.

## Gap 4 — Closing coordinator  (`packages/types`, `packages/db`, `apps/desk`)
**Why:** Max's last module — the "quarterback" 5-phase close. Parcel has deal stages + a derived
activity timeline but no closing workflow. Largest net-new; phase-able.

- **Keystone:** `closing_tasks` table (deal_id, phase, label, status, due_at, done_at) +
  `deals.title_company`, `deals.closing_date`; `@parcel/db` store.
- Desk: a **Closing** tab on the deal page — Max's 5 phases (contract→assignment→buyer→diligence→
  close) as a checklist with toggle server actions; merge milestones into the existing activity
  timeline. Title-company integrations deferred.
- **Tests:** task template seeding, toggle/advance, timeline merge.

---

## Build order (keystone-first, so consumers don't break)
1. **Phase A — keystone** (types + migrations): itemized-MAO fields; `underwrites.comp_count`;
   `deals.title_company/closing_date`; `closing_tasks`; `messages.kind` (seller vs buyer-dispo).
   Re-check every consumer. `apply_migration` to live `homes` after review.
2. **Phase B — underwriting**: `comps.ts`, `repairs.ts`, itemized MAO. (Gap 1 + 3a)
3. **Phase C — outreach**: 6-touch drip. (Gap 3b)
4. **Phase D — desk**: deal-package PDF + route; `dispatchToBuyers` sends. (Gap 2)
5. **Phase E — desk**: closing coordinator UI + actions. (Gap 4)

**Verify after each phase:** `pnpm -r typecheck && pnpm -r test && pnpm --filter @parcel/desk build`,
then a live smoke test on the desk. Append a Session entry to `docs/SESSION-LOG.md` at the end.

## Stays manual by design (the legal moat)
Cold-calling / SMS / RVM automation; auto-sending any contract; live sends before attorney review.
Automating *up to* these gates is the entire design.
