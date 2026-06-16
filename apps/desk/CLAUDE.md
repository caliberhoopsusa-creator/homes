# apps/desk — agent rules

You own `apps/desk` (the Parcel operator cockpit). Work only here.

- Import shared row/insert types from `@parcel/types` — never redefine a shape.
- Import the spread math from `@parcel/underwriting` (`underwrite()`) — never
  reimplement the 70% rule. The desk's numbers must equal the engine's.
- All data access goes through `lib/data.ts`, which picks Supabase when env is
  set (`NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY`) else in-memory `lib/fixtures.ts`.
  Keep this the single seam so live is a one-flag swap.
- No secrets in source. Contracts are sent ONLY by explicit human click
  (`/contracts`) — never auto-send. The radius-pull button POSTs a
  zod-validated `RadiusPullRequest` to `app/api/pull` (a stub).
- Stay within PRD §6.6 scope. Clean and minimal over fancy.
