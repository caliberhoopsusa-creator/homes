# Parcel — global rules

Automated wholesale acquisition engine. Source distressed properties → underwrite →
compliant outreach → classify replies → gated contract → drop warm leads in the desk.

## The bet
We earn the **assignment-fee spread** (contract price vs. end-buyer ceiling). The
defensible asset is the owned **buyer list** + the **speed/quality of the funnel**.
Goal: a platform that nets **$10k/month** — roughly **one $12k assignment/month**.

## Non-negotiables (see PRD §8)
1. **No cold contracts.** A contract is generated only on a positive-intent reply and
   sent only by an explicit one-click human action. Never auto-send to a cold recipient.
2. **CAN-SPAM on every send:** truthful headers, physical mailing address, working
   one-click unsubscribe, opt-outs honored ≤10 days, permanent suppression list.
3. **One operator, many deals.** Automation makes one person move like a team. The human
   stays in the two moments that matter: approving an offer and approving a contract.
4. **MT broker line:** we market *an offer to buy*, never *the property for sale*. The
   assignment template must be reviewed by a Montana RE attorney before the first live send.

## Architecture rules (§7.4)
- **Services communicate through Postgres tables only** (the schema in `supabase/migrations`).
  No service imports another service's internals.
- **Import shared types only from `@parcel/types`.** Never redefine a shared shape.
- **No secrets in source.** All keys via env. Provider integrations sit behind named
  interfaces so they are swappable and mockable. Default impls are mocks; real keys opt in.
- Each module ships its own tests + a short README of its contract. Stay within the
  module's "done when" — do not gold-plate.
- The schema is the keystone: a change to `supabase/migrations` or `@parcel/types`
  requires review across all modules.

## Layout
```
packages/types        shared TS types + zod schemas (read-mostly)
supabase/migrations   the schema (Phase 0, blocks everything)
services/sourcing     radius pull → properties
services/skiptrace    properties → owners (contact info)
services/underwriting pure 70% math → underwrites
services/outreach     owners of clearing deals → messages (SendGrid)
services/intake       replies → intent → gated contract  (Phase 2)
apps/desk             Next.js operator cockpit
```

## Tooling
pnpm workspace · TypeScript (strict) · Vitest. `pnpm -r test`, `pnpm -r typecheck`.
