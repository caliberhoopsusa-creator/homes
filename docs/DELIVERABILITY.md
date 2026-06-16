# Email Deliverability — Parcel outreach

> How to get outreach into the inbox (≥90% placement, PRD §6.4) and stay compliant.
> Sources: SendGrid/Twilio docs, Google/Yahoo 2024 sender rules, dmarc.org (mid-2026).
> *Verify live vendor specifics before budgeting — pricing/limits move.*

## 0. The stack (cheapest compliant, mid-2026)
- **Domain:** a `.com` (~$10/yr, Cloudflare Registrar or Porkbun). Send from a **subdomain** like `offers.yourbrand.com` — never your primary domain. The subdomain itself is free (just DNS).
- **SendGrid:** the permanent free tier was **retired May 27, 2025**. Now a **60-day trial (100 emails/day)** → **Essentials $19.95/mo (50k emails)**. A dedicated IP ($30/mo) is **Pro-only and unnecessary** at this volume (shared IP is correct for low volume).
- **Inbound Parse** (for replies → `/api/inbound`): historically on all accounts — **verify it's available on your plan**, since `intake` depends on it.

## 1. Authentication (free DNS records — do all three)
| Record | Purpose |
|---|---|
| **SPF** (TXT) | Authorizes SendGrid to send for your subdomain. |
| **DKIM** (CNAMEs) | Cryptographically signs mail. SendGrid "Authenticate Your Domain" with **Automated Security** generates the CNAMEs and rotates keys for you. |
| **DMARC** (TXT) | Ties it together. Start at `v=DMARC1; p=none; rua=mailto:dmarc@yourdomain` and tighten later. |

In SendGrid: **Settings → Sender Authentication → Authenticate Your Domain** → add the generated CNAMEs at your registrar → verify.

## 2. Google/Yahoo bulk-sender rules (2024+, mandatory)
For senders of **5,000+ messages/day to Gmail** (and Yahoo best-practice for all):
- **SPF *and* DKIM both pass**, with alignment.
- **DMARC** present (min `p=none`).
- **RFC 8058 one-click `List-Unsubscribe`** with a working **HTTPS** unsubscribe endpoint.
- **Honor opt-outs within 48 hours** (stricter than CAN-SPAM's 10 days — Parcel suppresses immediately, so you're covered).
- Keep **spam-complaint rate < 0.1%**; **never ≥ 0.3%**.

> Parcel already builds the one-click unsubscribe token + physical address into every body (`outreach/compliance.ts`). Make `UNSUBSCRIBE_BASE_URL` resolve to a real HTTPS handler that writes a `suppressions` row.

## 3. Warm-up ramp (free, manual — do NOT skip)
New domains/IPs must ramp slowly or you'll land in spam. ~2–4 weeks, watch bounces/complaints, scale only if clean. Tie this to `campaigns.daily_cap`.

| Week | Daily cap (approx) | Notes |
|---|---|---|
| 1 | 10–20/day | Best-quality, most-likely-to-engage owners first. |
| 2 | 30–50/day | Hold if complaints rise. |
| 3 | 75–150/day | Steady, consistent daily volume. |
| 4+ | 200+/day | Only if spam rate < 0.1% and bounces low. |

Paid warmup tools (Warmy/Mailreach ~$30–50/mo) automate this, but **manual ramping is free and sufficient** at Parcel's volume.

## 4. Pre-send CAN-SPAM checklist (every send)
- [ ] Truthful `From`/subject; no deceptive headers.
- [ ] **Physical mailing address** in the footer (`MAILING_ADDRESS`).
- [ ] Working **one-click unsubscribe** (per-owner token, HTTPS).
- [ ] Suppression checked **before** send; opt-outs honored ≤10 days (Parcel: immediate).
- [ ] Touch 1 is plain-text-feel, **no images/links**.
- [ ] Market **an offer to buy**, never **the property for sale** (MT broker line).

## 5. Env mapping (`.env.example`)
`EMAIL_PROVIDER=sendgrid` · `SENDGRID_API_KEY` · `SENDGRID_FROM_DOMAIN=offers.yourbrand.com` · `SENDGRID_FROM_EMAIL` · `SENDGRID_REPLY_TO` (a monitored inbox) · `MAILING_ADDRESS` · `UNSUBSCRIBE_BASE_URL`.

### Sources
SendGrid free-plan retirement & pricing: twilio.com/en-us/changelog/sendgrid-free-plan · twilio.com/en-us/products/email-api/pricing · Domain auth: twilio.com/docs/sendgrid/ui/account-and-settings/how-to-set-up-domain-authentication · Google sender guidelines: support.google.com/a/answer/81126 & /14229414 · Yahoo: senders.yahooinc.com/best-practices/ · DMARC: dmarc.org/overview/ · Registrars: cloudflare.com registrar, porkbun.com/products/domains.
