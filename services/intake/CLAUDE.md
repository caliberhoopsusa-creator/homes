# services/intake — agent rules

You own `services/intake`. Import shared types from `@parcel/types` only.

- NO COLD CONTRACTS (CLAUDE.md #1): a contract is generated ONLY on an
  `interested` reply, and ONLY as `status='queued'`. This service NEVER sends —
  a human approves in the desk. Do not add a send path here.
- The assignment template MUST be attorney-reviewed before live use (#4): keep
  the `ATTORNEY_REVIEW_NOTICE` stamped until `CONTRACT_TEMPLATE_REVIEWED=true`.
- `do_not_contact`/opt-out replies write a permanent suppression and never create
  a contract.
- No DB client or live SDK in this module — DB via the injected `IntakeStore`;
  Anthropic and Supabase Storage sit behind interfaces defaulting to mocks. No
  secrets in source; keys via env.
- Done-when: PRD §6.5 — a "yes" reply yields a queued contract PDF + a desk deal
  in < 60s; a "remove me" reply suppresses the owner. Do not exceed scope.
