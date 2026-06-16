---
name: testing
description: Parcel testing conventions — Vitest, deterministic mock providers, fake injected stores, full coverage on pure logic, and no live network. Use when writing or reviewing tests.
metadata:
  origin: adapted from ECC react-testing (vetted & tailored for Parcel)
---

# Testing (Parcel)

Vitest per package (`pnpm -r test`). Tests run with zero external keys.

## When to activate
- Adding a service/runner/provider, or changing pure logic.

## Conventions
- **Pure logic gets full coverage.** `underwrite()` (the 70% math) is the canonical example —
  test every verdict boundary (`clear`/`thin`/`pass`) exactly.
- **Inject a fake store** to test runners (`class FakeStore implements XStore`). No DB in tests.
- **Mock providers are deterministic** (seeded) so counts/thresholds are stable.
- **No live network.** For real-shape providers (BatchData/Firecrawl/SendGrid/Anthropic), stub
  the global `fetch` with `vi.stubGlobal("fetch", vi.fn(async () => ({ ok, status, json })))` and
  assert the request mapping + response handling. Clean up in `afterEach`.
- **Test the invariants, not just happy paths:** suppression skip (outreach), no-downgrade
  (skiptrace), the `do_not_contact` → no-contract gate and the `interested` → queued-contract
  gate (intake), dedupe on re-run (sourcing).

## Pattern: real-shape provider test
```ts
vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200,
  headers: { get: () => null }, json: async () => ({ /* provider payload */ }) })));
const p = new RealProvider({ apiKey: "test" });
expect(await p.call(...)).toEqual(/* mapped result */);
// also: throws without a key; throws on non-ok; ToS denylist drops forbidden domains.
```

## Verify
`pnpm -r typecheck && pnpm -r test` green; coverage on pure math at 100%.
