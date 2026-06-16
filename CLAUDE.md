# Parcel — global rules

Automated wholesale acquisition engine: source distressed properties → underwrite →
compliant outreach → classify replies → **gated** contract → warm leads in the desk.
We earn the assignment-fee spread; target ~$10k/month (≈ one $10k assignment).

**`PRD.md` is the source of truth — re-read it if unsure.**
**`docs/SESSION-LOG.md` = current state + per-session changelog — read it to catch up.**

## Non-negotiables (hard rules)
1. **DB-only comms.** Services communicate ONLY through the Supabase tables in PRD §5.
   Never import another service's internals. (DB access inside a service = an injected
   store interface; concrete Postgres stores live in `packages/db`.)
2. **One source of types.** All shared types come from `packages/types` (`@parcel/types`).
   Never redefine a shared shape.
3. **No cold contracts.** A contract is generated only on a positive-intent reply, and
   sent only by explicit one-click human approval. Never auto-send to a cold recipient.
4. **CAN-SPAM every send.** Truthful headers, physical mailing address, working one-click
   unsubscribe, opt-outs honored ≤10 days, permanent suppression list.
5. **MT broker line.** Market *an offer to buy*, never *the property for sale*. Assignment
   template needs Montana RE-attorney review before the first live send.
6. **No secrets in source.** All keys via env. Provider integrations sit behind named
   interfaces — mock default, real key opt-in.
7. **Scope discipline.** Stay within each module's "done when" line (PRD §6). Don't gold-plate.

## Stack
Supabase/Postgres (migrations = schema source of truth) · TypeScript (strict) Node
services · SendGrid (send + Event/Inbound webhooks) · Next.js desk (PWA) · Anthropic API
(reply-intent classification + email personalization). pnpm workspace · Vitest.
Verify: `pnpm -r typecheck && pnpm -r test`.

## Layout & ownership
```
packages/types   KEYSTONE: shared types + zod schemas (read-mostly)
packages/db      Supabase client + Postgres store impls (wiring layer)
supabase/migrations   the schema (Phase 0, blocks everything)
services/{sourcing,skiptrace,underwriting,outreach,intake}   one concern each
apps/desk        Next.js operator cockpit
```
**One agent per worktree, one module per agent.** Each agent owns exactly its `services/X`
(or `apps/desk`), imports shared types from `@parcel/types`, talks to other modules only via
Postgres tables, and never edits another module. A change to `supabase/migrations` or
`packages/types` is a **keystone change** — re-check every consumer.
