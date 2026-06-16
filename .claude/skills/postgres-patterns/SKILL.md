---
name: postgres-patterns
description: PostgreSQL/Supabase patterns for Parcel — indexing, RLS, upserts, and migration discipline. Use when writing migrations or store queries.
metadata:
  origin: adapted from ECC / Supabase Agent Skills (MIT) — vetted & tailored for Parcel
---

# Postgres Patterns (Parcel)

`supabase/migrations` is the source of truth. `@parcel/types` mirrors it by hand until a real
project is wired (then `supabase gen types`).

## When to activate
- Writing a migration or changing the schema (a keystone change).
- Writing/optimizing a query in a `packages/db` store.

## Index cheat sheet
| Query pattern | Index |
|---|---|
| `WHERE col = v` / `col > v` | B-tree (default) |
| `WHERE a = x AND b > y` | composite `(a, b)` — equality first, range last |
| `WHERE jsonb @> '{}'` / FTS | `USING gin (col)` |
| time-series ranges | `USING brin (col)` |

## Patterns
**RLS (optimized):** wrap functions in a SELECT so the planner caches them:
```sql
create policy p on owners using ((select auth.uid()) is not null);
```
Every table has RLS enabled + a policy in the same migration (PRD §8.5).

**Upsert (suppression / idempotent writes):**
```sql
insert into suppressions (email, reason) values ($1, $2)
on conflict (email) do update set reason = excluded.reason;
```

**Index foreign keys** used in joins/filters (we index `*_property_id`, `*_owner_id`).

**Cursor pagination** (`WHERE id > $last ORDER BY id LIMIT n`) over `OFFSET` for large sets.

## Parcel specifics
- Money is `numeric`, timestamps `timestamptz`, ids `uuid default gen_random_uuid()`.
- `suppressions.email` is `unique` (permanent opt-out). `properties` unique `(source, source_id)`.
- Owner PII (email/phone/mailing) is sensitive — never select it into logs.

*Index/RLS guidance credit: Supabase team (MIT).*
