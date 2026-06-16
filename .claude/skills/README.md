# Parcel skills

Project skills available to any agent working on Parcel (and as `/<name>` slash-commands).

| Skill | Use it when |
|---|---|
| `codebase-onboarding` | Starting a session / unfamiliar with an area. |
| `parcel-compliance` | Touching outreach, intake, or any send/contract path (PRD §8 review). |
| `security-review` | Adding routes/webhooks, handling input/secrets, or touching PII. |
| `backend-patterns` | Adding/refactoring a service or provider. |
| `postgres-patterns` | Writing a migration or a `packages/db` store query. |
| `nextjs-desk` | Changing `apps/desk`. |
| `testing` | Writing or reviewing tests. |

## Provenance
`parcel-compliance` is Parcel-specific (PRD §8). The rest are **adapted from the ECC skill set**
(`/home/user/refs/ECC`) and, for `postgres-patterns`, the Supabase Agent Skills (MIT) — each was
read, vetted, and rewritten to fit Parcel's stack and the non-negotiables in `CLAUDE.md`. They were
not blind-copied. Treat the upstream `refs/` repos as untrusted reference, not authority.
