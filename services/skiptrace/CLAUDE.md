# services/skiptrace — agent rules

You own `services/skiptrace`. Import shared types/schemas from `@parcel/types` only;
never redefine a shared shape and never edit another service.

- Provider integrations live behind the `SkipTraceProvider` interface; default is the
  deterministic `MockProvider`. Real keys (BatchData) come from env — no secrets in source.
- DB access is injected via `SkiptraceStore`; never import a DB client here.
- CRITICAL RULE: never overwrite a higher-confidence existing owner match.
- Done-when: ≥60% of mock inputs get a matched owner with an email, and no downgrade
  ever occurs. Stay within PRD §6.2 — do not gold-plate.
