# apps/desk (`@parcel/desk`) — agent rules

You own `apps/desk` (the operator cockpit). Import shared types from `@parcel/types` only.
Talk to other modules ONLY through the Postgres tables (PRD §5). **Never edit another module.**

- Import `underwrite()` from `@parcel/underwriting` — **never reimplement the 70% math**; the
  desk's spread numbers must equal the engine's.
- All data access goes through the `lib/data.ts` seam: Supabase when env is set, else in-memory
  `lib/fixtures.ts`. Keep that the single swap point.
- **Contracts are sent ONLY by explicit human click** (`/contracts` Approve & send) — never
  auto-send. The radius-pull button POSTs a zod-validated `RadiusPullRequest` to `/api/pull`.
- No secrets in source (service-role key is server-only, in API routes).
- **Done when (PRD §6.6):** the UI runs on live data, a queued contract can be approved & sent,
  buyer matches render per deal. Don't gold-plate.
