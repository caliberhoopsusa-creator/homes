# @parcel/db

The wiring / composition layer: a Supabase **service-role** client plus a
Postgres implementation of every service's injected store interface. Services
stay DB-free and mockable; this package is where they meet real Postgres.

- `createServiceClient(env)` — service-role client (server-only; throws if unset).
- `SourcingDbStore`, `SkiptraceDbStore`, `UnderwriteDbStore`, `OutreachDbStore`,
  `IntakeDbStore` — each implements the matching service interface against the
  §5 schema.

Importing a service's store **interface type** is the intended contract; this
layer composes services, it does not reach into their internals. No secrets in
source — keys come from `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`.
