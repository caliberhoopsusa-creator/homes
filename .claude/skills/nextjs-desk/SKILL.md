---
name: nextjs-desk
description: Conventions for apps/desk (Next.js App Router) — route handlers, workspace transpile/alias, the data seam, and gotchas. Use when changing the desk.
metadata:
  origin: adapted from ECC nextjs-turbopack (vetted & tailored for Parcel)
---

# Next.js Desk (Parcel)

The operator cockpit. Next 15 App Router + Tailwind. Runs on fixtures with zero env.

## When to activate
- Adding a page, component, or API route to `apps/desk`.
- Debugging a desk build/typecheck issue.

## Conventions
- **Data seam:** all reads/writes go through `lib/data.ts` — Supabase when
  `NEXT_PUBLIC_SUPABASE_URL/_ANON_KEY` are set, else in-memory `lib/fixtures.ts`. Keep this the
  single swap point; don't query Supabase directly from a page.
- **Never reimplement the 70% math** — import `underwrite()` from `@parcel/underwriting` so the
  spread bar can't drift.
- **API routes that touch the DB** use the service-role client (`@parcel/db`), must set
  `export const runtime = "nodejs"`, and live server-side only. Validate the body with a
  `@parcel/types` zod schema. Acknowledge (202) when Supabase env is absent.
- **Contracts send only on explicit human click** (`/contracts`) — never auto-send.

## Build gotchas (already solved — don't re-discover)
- `next.config.js` must list every `@parcel/*` it imports in `transpilePackages` AND set a
  webpack `extensionAlias` `.js → .ts` (workspace source uses ESM `.js` suffixes).
- A directly-imported workspace package must be a declared dep (pnpm won't resolve transitively).
- Stale type error after a fix? The desk uses `incremental: true` — `rm -rf apps/desk/.next` and re-run.

## Verify
`pnpm --filter @parcel/desk typecheck && pnpm --filter @parcel/desk build`
