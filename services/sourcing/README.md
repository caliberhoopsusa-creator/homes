# @parcel/sourcing

Radius pull → `properties` rows (PRD §6.1). Contract:
`runPull(provider, store, RadiusPullRequest)` fetches candidates, normalizes
distress tags, validates each against `propertyCandidate`, filters to the radius +
request filters, dedupes on `source+source_id` (within batch and against the
injected `SourcingStore`), and inserts. Providers (`mock` default | `batchdata`)
sit behind `PropertyProvider`, selected by `PROPERTY_PROVIDER`; keys via env only.
