---
name: backend-patterns
description: Parcel service architecture — DB-only comms, injected store interfaces, provider-behind-interface with mock defaults, and shared types. Use when adding/refactoring a service or its providers.
metadata:
  origin: adapted from ECC (vetted & tailored for Parcel)
---

# Backend Patterns (Parcel)

The architecture rules that keep modules parallel-buildable and swappable.

## When to activate
- Adding a service, a provider, or a runner.
- Wiring a service to the database.

## Patterns

### Services talk through Postgres only
- A service reads its input rows and writes its output rows. It never imports another
  service's internals. Cross-service contracts are the §5 tables + `@parcel/types`.

### Injected store, never a DB client in a service
```ts
export interface XStore { needsWork(): Promise<Row[]>; insert(r: Insert): Promise<void>; }
export async function runX(store: XStore) { /* pure orchestration; no supabase import */ }
```
Concrete Postgres stores live in `packages/db` (`XDbStore`). Tests pass a fake store.

### Providers behind a named interface, mock default
```ts
export interface FooProvider { call(...): Promise<...>; }
export class MockProvider implements FooProvider {}     // default, deterministic
export class RealProvider implements FooProvider {       // reads key from env
  constructor(key = process.env.FOO_KEY) { if (!key) throw new Error("FOO_KEY unset"); }
}
export function makeProvider(env) { return env.FOO === "real" ? new RealProvider() : new MockProvider(); }
```
Nothing real fires without an explicit env opt-in.

### Shared types
- Import row/insert/enums from `@parcel/types` only. A change to types or
  `supabase/migrations` is a keystone change — re-check every consumer.

### Error handling & idempotency
- Throw with context (`"FooProvider: 502 from Foo"`). Runners that may be re-run
  (webhooks, pulls) must dedupe (e.g. `source+source_id`) so retries don't double-write.

### Module hygiene
- ESM `.js` import suffixes, `"type":"module"`, tsconfig extends base (`noEmit`, no `rootDir`).
- Read env/fetch via a `globalThis` cast — never `declare global { function fetch }` (it leaks).
- Stay within the PRD §6 "done when". Ship a 5-line README + tight CLAUDE.md.
