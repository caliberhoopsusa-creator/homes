# services/intake (`@parcel/intake`) — agent rules

You own `services/intake`. Import shared types from `@parcel/types` only. Talk to other
modules ONLY through the Postgres tables (PRD §5). **Never edit another module.**

- **NO COLD CONTRACTS:** a contract is generated ONLY on an `interested` reply, ONLY as
  `status='queued'`. This service NEVER sends — a human approves in the desk. No send path here.
- Keep the attorney-review notice stamped on the PDF until `CONTRACT_TEMPLATE_REVIEWED=true`.
- `do_not_contact`/opt-out → permanent suppression, never a contract.
- Externals (Anthropic, Supabase Storage, DB) sit behind injected interfaces — mock default,
  keys via env, no secrets in source.
- **Done when (PRD §6.5):** a "yes" reply → queued contract PDF + a `Contacted` deal in < 60s;
  a "remove me" reply → owner suppressed. Don't gold-plate.
