# packages/db — rules

The composition/wiring layer. It MAY depend on the service packages (for their
store **interface types**) and `@supabase/supabase-js` — it is not a service and
the "no service imports another service" rule doesn't apply here.

- Implement each store strictly against the §5 schema and the interface the
  service exports. Never widen or redefine a service's interface.
- Service-role key is server-only — never expose it to the browser. No secrets
  in source; read from env via `createServiceClient`.
- Enforce the same invariants the mocks do (e.g. skiptrace no-downgrade,
  contracts inserted as `queued`). The DB store must behave like the mock.
