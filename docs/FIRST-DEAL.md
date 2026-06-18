# Parcel — Runbook: making the first deal

> The whole funnel is built and green. The first real assignment is blocked by a
> few **external** setup steps + **one legal gate** — not by code. This is the
> ordered checklist. Status of each integration is also live in the desk's
> **Setup** tab. See also `docs/GO-LIVE.md`, `docs/DELIVERABILITY.md`,
> `docs/MONTANA-LEGAL.md`.

## Already done (no work)
- **Live leads:** 200+ real Montana absentee leads in the DB (free state Cadastral
  source). The **Find leads** button pulls more — free, no key. They're on the **Leads** tab.
- Underwriting (comps + itemized MAO), 6-touch outreach, reply→gated contract,
  buyer matching + dispatch, contract PDF, closing coordinator, beginner UI.

## What's needed for the first deal (in order)

### 1. Skip-trace key — real seller contacts  ·  *blocks contact*
Owner emails are placeholders until this is set. Buy a skip-trace key (e.g.
BatchData), then in `apps/desk/.env.local`:
```
SKIPTRACE_PROVIDER=batchdata
BATCHDATA_API_KEY=...
```
→ real owner email/phone on your county leads.

### 2. SendGrid — actually send the offers  ·  *blocks outreach*
Emails are simulated until this is set. Create a SendGrid account, **authenticate
a sending domain** (SPF/DKIM/DMARC — `docs/DELIVERABILITY.md`), then:
```
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=...
SENDGRID_FROM_DOMAIN=offers.yourdomain.com
```

### 3. SendGrid Inbound Parse — replies become contracts  ·  *built, needs config*
Point Inbound Parse at your domain → `https://<your-desk>/api/inbound`. A "yes"
reply is then auto-classified into a **queued** contract.

### 4. Montana attorney review — THE hard gate  ·  *blocks the contract send*
You legally cannot send a real assignment contract until a Montana RE attorney
reviews the template (`docs/MONTANA-LEGAL.md`). Then:
```
CONTRACT_TEMPLATE_REVIEWED=true
```
**Start this now, in parallel — it's the long pole.**

### 5. A few real cash buyers  ·  *blocks the exit*
You have public-record-inferred buyers; for the first deal add a handful of **real**
cash buyers who'll actually close, on the **Buyers** page.

## The loop (once 1–5 are in)
Run outreach at volume → warm reply → **review & approve** the queued contract →
**assign** a cash buyer → work the **closing checklist** → collect the fee.
Research math: **~66 leads → ~10–15 offers → ~1 deal**, ~$10k fee.

## Cost
SendGrid ~$20/mo · domain ~$10/yr · skip-trace (per-lookup/plan) · Anthropic ~$1–5/mo
· attorney review = one-time. Leads + Supabase + sourcing = free.

## Optional (not blocking the first deal)
- Consent-only **SMS** (Twilio + registered number + opt-ins via `/sms-optin`).
- Pre-go-live hardening: Twilio webhook signature, opt-in rate limiting,
  buyer-reply→suppression, operator-route auth (see `.claude/reviews/pr-5-review.md`).

## Dev tip
If the desk shows `Cannot find module './vendor-chunks/…'` (a Next dev-cache
glitch, not your data), run: `pnpm --filter @parcel/desk dev:clean`.
