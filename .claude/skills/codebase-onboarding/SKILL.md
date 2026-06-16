---
name: codebase-onboarding
description: Come up to speed on Parcel fast — read order, layout, verify commands, and where things plug in. Use at the start of a session or when unfamiliar with an area.
metadata:
  origin: adapted from ECC (vetted & tailored for Parcel)
---

# Codebase Onboarding (Parcel)

## Read order (do this first)
1. `CLAUDE.md` — the hard rules (rules an agent scans in seconds).
2. `PRD.md` — the source of truth for intent (§5 schema, §6 module specs, §8 compliance).
3. `docs/SESSION-LOG.md` — current state + per-session changelog + solved gotchas.

## Layout
`packages/types` (keystone types+zod) · `packages/db` (Supabase client + Postgres stores) ·
`supabase/migrations` (schema) · `services/{sourcing,skiptrace,underwriting,outreach,intake}`
(one concern each, DB-only comms, injected stores) · `apps/desk` (Next.js cockpit).

Funnel: `sourcing → skiptrace → underwriting → outreach → intake (gated contract) → desk`.

## Where things plug in
- New data source → a `PropertyProvider`/`SkipTraceProvider` impl + factory case (env-selected).
- New email/AI vendor → `EmailProvider`/`Personalizer`/`IntentClassifier` impl, mock default.
- DB access → an injected store interface; concrete impl in `packages/db`.
- Going live → real keys in env + provision Supabase + flip the desk data seam.

## Verify the whole thing (keyless)
```
pnpm install
pnpm -r typecheck      # 8/8 clean
pnpm -r test           # ~80 tests
pnpm --filter @parcel/desk build
```

## End of session
Append a dated entry to `docs/SESSION-LOG.md` capturing what changed (every detail).
