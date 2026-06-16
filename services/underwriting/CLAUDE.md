# services/underwriting (`@parcel/underwriting`) — agent rules

You own `services/underwriting`. Import shared types from `@parcel/types` only. Talk to other
modules ONLY through the Postgres tables (PRD §5). **Never edit another module.**

- `underwrite()` is PURE and the canonical source of the spread — **the desk imports it**, so
  keep it stable and add no I/O or external deps to it.
- DB access is the injected `UnderwriteStore` — never import a DB client here.
- **Done when (PRD §6.3):** matches the §6.3 math exactly, with full test coverage on the math.
  Don't gold-plate.
