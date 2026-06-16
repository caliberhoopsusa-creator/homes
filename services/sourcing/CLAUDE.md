# services/sourcing (`@parcel/sourcing`) — agent rules

You own `services/sourcing`. Import shared types from `@parcel/types` only. Talk to other
modules ONLY through the Postgres tables (PRD §5). **Never edit another module.**

- Providers sit behind the `PropertyProvider` interface — `MockProvider` is the default;
  BatchData/Firecrawl opt in via `PROPERTY_PROVIDER` + env keys (no secrets in source).
  Firecrawl: PERMITTED public sources only; Zillow/Redfin/Trulia/Realtor are ToS-denied.
- DB access is the injected `SourcingStore` — never import a DB client here.
- **Done when (PRD §6.1):** a mock pull writes ≥500 deduped rows, re-runs add no duplicates,
  every row has ≥1 distress tag. Don't gold-plate.
