---
name: parcel-compliance
description: Review Parcel code against the four non-negotiable compliance rules — no cold contracts, CAN-SPAM, the Montana broker line, and PII handling. Use before shipping anything in outreach, intake, or the desk.
metadata:
  origin: Parcel-specific (PRD §8)
---

# Parcel Compliance Review

The rules in PRD §8 are requirements, not suggestions. If a change works around one, STOP and flag it.

## When to activate
- Any change in `services/outreach`, `services/intake`, or the desk's send/contract paths.
- Adding a new send, contract, or reply-handling path.

## Checklist

### 1. No cold contracts (PRD §8.1)
- [ ] Contracts are generated ONLY on an `interested` reply (`services/intake`).
- [ ] Generated contracts are `status='queued'` and **never sent** by automation.
- [ ] Sending happens ONLY via explicit human click in the desk Contracts queue.
- [ ] No path creates/sends a contract to a cold or suppressed recipient.

### 2. CAN-SPAM on every send (PRD §8.2)
- [ ] Every email body carries a truthful subject/from, a **physical mailing address**,
  and a working one-click unsubscribe (per-owner token). `isCompliant()` must gate sends.
- [ ] `isSuppressed(email)` is checked before any send; `do_not_contact`/`unsubscribe` are permanent.
- [ ] Opt-outs honored ≤10 days (suppression is immediate here).

### 3. Montana broker line (PRD §8.3)
- [ ] Copy markets *an offer to buy* / an assignable equitable interest — never *the property for sale*.
- [ ] The assignment template stays stamped DRAFT until `CONTRACT_TEMPLATE_REVIEWED=true`
  (Montana RE-attorney review is a hard gate before the first live send).
- [ ] A deal-count/volume metric is visible so the operator can pace (broker-scrutiny risk).

### 4. Data & PII (PRD §8.4–8.5)
- [ ] Sources respect ToS: no Zillow/Redfin/Trulia/Realtor scraping (Firecrawl denylist enforced).
- [ ] Owner PII behind RLS; never logged.

## Verify
Trace the path: reply → `handleInboundReply` (gate) → `contracts.status='queued'`; and
`runCampaign` → `isSuppressed` + `isCompliant` before `provider.send`. Both must hold.
