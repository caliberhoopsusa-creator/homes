# @parcel/skiptrace

Properties without a matched owner → `owners` rows with contact info (PRD §6.2).
Contract: `runSkiptrace(provider, store)` traces each property via a
`SkipTraceProvider` (`mock` default | `batchdata`, selected by `PROPERTY_PROVIDER`;
keys via env only) and upserts an owner, setting `skiptrace_status` to
`matched`/`none`. CRITICAL: it never downgrades a higher-confidence existing
match — the injected `SkiptraceStore` exposes current confidence so downgrades skip.
