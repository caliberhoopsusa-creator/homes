# services/skiptrace (`@parcel/skiptrace`) — agent rules

You own `services/skiptrace`. Import shared types from `@parcel/types` only. Talk to other
modules ONLY through the Postgres tables (PRD §5). **Never edit another module.**

- Providers sit behind the `SkipTraceProvider` interface — `MockProvider` is the default;
  BatchData/Firecrawl opt in via `PROPERTY_PROVIDER` + env keys (no secrets in source).
- **CRITICAL:** never overwrite a higher-confidence existing owner match (no downgrades).
- DB access is the injected `SkiptraceStore` — never import a DB client here.
- **Done when (PRD §6.2):** ≥60% of inputs get a `matched` owner with an email. Don't gold-plate.
