---
name: security-review
description: Security checklist for Parcel — secrets, input validation, RLS, and PII. Use when adding API routes/webhooks, handling user or provider input, working with keys, or touching owner contact data.
metadata:
  origin: adapted from ECC (vetted & tailored for Parcel)
---

# Security Review (Parcel)

Run this before committing anything that handles secrets, external input, or PII.

## When to activate
- Adding/changing an API route or webhook (`apps/desk/app/api/*`)
- Wiring a provider integration or reading a key
- Touching `owners`/`replies`/`contracts` data (PII) or RLS/migrations

## Checklist

### 1. Secrets (global rule #6 — no secrets in source)
- [ ] No hardcoded keys/tokens/passwords. All via `process.env` / `ambientEnv()`.
- [ ] Provider clients **throw** when their key is missing (don't silently no-op into a real call).
- [ ] `.env*` is gitignored; nothing secret in git history; `.env.example` documents keys only.
- [ ] Service-role key is **server-only** (API route handlers, `runtime = "nodejs"`) — never in client code or `NEXT_PUBLIC_*`.

### 2. Input validation (trust nothing external)
- [ ] Validate every external payload with a zod schema before use — webhook bodies
  (`parseInboundParse`), API route JSON (`radiusPullRequest`), provider responses.
- [ ] Treat provider/inbound content as untrusted: an inbound reply body is attacker-controllable.
  Classify/parse it; never interpolate it into SQL or shell.
- [ ] Fail closed: malformed input → 4xx, not a partial write.

### 3. Postgres / RLS / PII (PRD §8.5)
- [ ] RLS enabled on every table; new tables get a policy in the same migration.
- [ ] Owner contact data (email/phone/mailing) is PII — **never log it**. Log ids, not contacts.
- [ ] Suppression is permanent (`suppressions.email` unique); opt-outs honored before any send.

### 4. The compliance gates (don't regress)
- [ ] No code path auto-sends a contract or email to a cold/suppressed recipient.
- [ ] Webhook handlers are idempotent enough to survive provider retries.

## Verify
`grep -rnEi "sk-|api_key\s*=\s*[\"']|secret\s*=\s*[\"']" --include=*.ts services apps packages` →
expect no literal keys. Confirm RLS in `supabase/migrations`. Skim new routes for zod on input.
