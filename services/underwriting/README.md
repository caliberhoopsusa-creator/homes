# services/underwriting

**Contract:** `properties` (+ ARV/repair estimates) → one `underwrites` row each.

- `underwrite()` — pure 70% math, the single source of truth for the spread.
- `estimateInputs()` — v1 AVM × per-sqft heuristic (flags `is_estimate`).
- `runUnderwriting(store)` — writes an `underwrites` row per un-underwritten property.

Math: `buyer_ceiling = arv*rule_pct - repairs` · `your_mao = buyer_ceiling - fee_target`
· `fee_potential = buyer_ceiling - asking`. Verdict: `clear` if fee ≥ target, `thin` if
> 0, else `pass`. The desk imports `underwrite()` from here so its spread bar can't drift.
