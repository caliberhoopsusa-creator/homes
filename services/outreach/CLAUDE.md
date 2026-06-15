# services/outreach — agent rules

You own `services/outreach`. Import shared types from `@parcel/types` only.

- CAN-SPAM is non-negotiable (CLAUDE.md #2): every send body MUST carry the
  physical mailing address and a working per-owner one-click unsubscribe. The
  footer is enforced in `compliance.ts` and asserted again in `runCampaign`.
- The suppression list is a HARD gate: `do_not_contact`/`unsubscribe` owners are
  NEVER messaged. Check `store.isSuppressed(email)` before any send.
- MT broker line (#4): market AN OFFER TO BUY, never the property FOR SALE.
- No DB client or live SDK in this module — all externals (DB, SendGrid,
  Anthropic) sit behind injected interfaces; default impls are mocks. No secrets
  in source; keys come from env only.
- Done-when: PRD §6.4 — 3 touches, compliant sends, suppression honored, daily
  cap respected, `messages` rows logged queued→sent. Do not exceed scope.
