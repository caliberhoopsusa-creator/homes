# services/underwriting — agent rules

You own `services/underwriting`. Import shared types from `@parcel/types` only.

- The math in `src/underwrite.ts` is PURE and the canonical source of the spread.
  Do not add I/O or external deps to it. The desk imports it — keep it stable.
- DB access is injected via the `UnderwriteStore` interface; never import a DB client here.
- Done-when: matches PRD §6.3 math exactly, with full test coverage on the math.
  Do not exceed scope.
