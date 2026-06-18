# services/outreach (`@parcel/outreach`) — agent rules

You own `services/outreach`. Import shared types from `@parcel/types` only. Talk to other
modules ONLY through the Postgres tables (PRD §5). **Never edit another module.**

- **CAN-SPAM is a HARD gate:** every body carries the physical mailing address + a working
  per-owner one-click unsubscribe (`isCompliant` throws otherwise). Check `isSuppressed`
  before any send — `do_not_contact`/`unsubscribe` owners are NEVER messaged.
- Market *an offer to buy*, never *the property for sale* (MT broker line).
- Externals (SendGrid, Anthropic, DB) sit behind injected interfaces — mock default, keys via
  env, no secrets in source.
- **Done when (PRD §6.4, extended per docs/AUTOMATION-PLAN.md):** 6 touches (day 0/3/7/14/21/30),
  suppression honored, daily cap respected, `messages` rows logged queued→sent. Don't gold-plate.
