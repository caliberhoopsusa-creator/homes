# services/sourcing — agent rules

You own `services/sourcing`. Import shared types/schemas from `@parcel/types` only;
never redefine a shared shape and never edit another service.

- Provider integrations live behind the `PropertyProvider` interface; default is the
  deterministic `MockProvider`. Real keys (BatchData) come from env — no secrets in source.
- DB access is injected via `SourcingStore`; never import a DB client here.
- Done-when: a mock pull yields ≥500 deduped rows, re-runs insert no duplicates,
  every row has ≥1 distress tag. Stay within PRD §6.1 — do not gold-plate.
