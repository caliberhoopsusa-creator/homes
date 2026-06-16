# Wholesaling — Pro Playbook & Research (for the Parcel build)

> Deep-research synthesis (8 agents, ~40 sources, June 2026). Anchored to primary law
> (FTC/FCC/courts/state statutes) and best-sampled datasets; vendor/"guru" figures flagged.
> **Not legal advice.** Wholesaling law is changing fast (2024–2026) and varies by state.

---

## 0. What we'll actually USE (build implications — read this first)

| Finding | Action for Parcel |
|---|---|
| Assignment fee planning number is **~$10k**, not $13–20k (vendor-inflated). | Consider `underwrites.fee_target` **$12k → $10k** so "$10k/mo ≈ ~1 deal" stays conservative and we don't price ourselves out of deals. |
| Funnel: **~66 leads → ~10–15 offers → 1 assignment**; **cost/deal $4–9k**. | Desk dashboard targets: leads/deal ≈ 66, offers/deal ≈ 10–15, marketing $/deal $4–9k. One stacked-list pull/month feeds ~1 deal. |
| **CAN-SPAM is stable & maps to our design**; **TCPA (SMS/calls/RVM) is a litigation minefield** ($500–$1,500/msg, +112% YoY suits, wholesalers flagged). | Stay **email-first**. Keep suppression + one-click unsubscribe + physical address (already built). Add SMS/calls only behind real consent infra + counsel. |
| Scraping **Zillow/Redfin/Realtor = ToS + CFAA/copyright risk**. Use licensed data (ATTOM/PropStream/BatchData) or APIs. | Already enforced via the Firecrawl ToS denylist. Keep it. |
| **70% rule / MAO** = ARV×0.70 − repairs − fee; repairs **~20–33% of ARV**; ARV conservatism is the #1 deal-saver. | Matches `underwrite()`. The `estimateInputs` repair heuristic (35/sqft) is a placeholder — wire a comps source + contractor bid before live. |
| Dispo tactic: send each deal to **top 3–5 matched buyers, 24-hr exclusive, then blast**. Buyer list = **county cash-closings (no mortgage lien), last ~6 mo**. Segment by **repair tolerance**. | Maps to `buyers` buy-box + `matchScore()`. Add a "top-N + 24h window" dispo flow; seed buyers from county cash-sale records. |
| **State law varies hard**; MT not covered by national sources. | MT statute + RE-attorney check is the existing hard gate. If we expand beyond MT, the state matters (see §3). |

---

## 1. Mechanics & money
- **Wholesaling** = put a property under contract, then **assign the contract** (not the property) to a cash buyer for a fee. Legal basis: **equitable conversion** — a signed purchase contract gives you an assignable *equitable interest* (a contract right = personal property). You're a **principal**, not a broker. (REtipster, RealEstateSkills)
- **Assignment** (no title taken; needs only earnest money) vs. **double close** (briefly take title; used to hide a large fee or when assignment is barred). Double close needs **transactional funding**: ~**1–2% (≈$2,500 min) up to ~12%** same-day. (RealEstateBees, BiggerPockets)
- **Assignment fee:** vendor "avg $13k" is inflated; **plan ~$10k**. Conservative $2–7k; realistic median $5–15k; high-cost metros $12–30k+. Fee ceiling rule: ≤ ~50% of buyer's projected profit (or 5–10% of contract price). (Real Estate Bees survey n=1,000+; Amerisave; REISift; iSpeedToLead)

## 2. Underwriting
- **MAO = (ARV × 0.70) − repairs − fee.** Ex: ARV $300k, repairs $40k, fee $15k → offer **$155k**. Rule stretches to **75–80%** in hot markets (thinner margin). (RealEstateSkills, REsimpli, REtipster)
- **ARV:** 3–6 recent *sold* comps, same area/size/condition, <6 mo, <1 mi. Biggest source of blown deals — be conservative.
- **Repairs:** **~20–33% of ARV** for distressed stock, or $/sqft; get a contractor bid.
- **Buyer pricing:** flippers price off **ARV** (need full profit at purchase → 70% rule binds); landlords price off rent/yield (**1% rule**, cap rate **5–10%**, cash-on-cash **8–12%**, BRRRR ≈75% LTV refi). 2025 flip profit fell to **~$66k gross / 25.5% ROI** (lowest since 2008) → flippers less tolerant of thin spreads now. (ATTOM, CNBC, Quicken, BiggerPockets, Baselane)

## 3. Legality & compliance (the part that can end you)
**Rule:** legal in all 50 states *as an act*, but oversimplified. Market your **contract/an offer to buy — never the property**; act as **principal, not agent**. Crossing the line = **unlicensed brokerage** (fines → felony in FL; fee unenforceability). A **double close does NOT reliably cure** a pattern-of-business licensing problem.

**Accelerating 2023–2026 crackdown — two models:**
- **License REQUIRED:** **IL** (1 deal/12 mo, then license — 225 ILCS 454), **OK** (Predatory Wholesaler Act 2021; **SB 1075 eff. 11/1/2025** adds disclosures, 2-day cancel, FDIC-held earnest, double-close no longer a workaround), **SC** (H4754, 2024 — brokers barred), **PA** (Act 52/SB 1173, eff. 1/4/2025).
- **DISCLOSURE required (license-free):** **TX** (Occ. Code §1101.0045), **AZ** (ARS §44-5101, 2022), **MD** (RP §10-715, eff. 10/1/2025), **ND** (HB 1125, eff. 8/1/2025), **TN** (SB 909, eff. ~4/8/2025), **OH** (ORC §5301.95, eff. 3/2/2026).
- **Registration:** **CT** (eff. 7/1/2026). **Pending:** **LA** (HB 468, eff. 8/1/2026).
- **Montana:** not addressed by national sources → **direct statute + MT RE-attorney check required** (the existing hard gate).

**Outreach law:**
- **CAN-SPAM (email):** truthful headers, physical address, working unsubscribe (live ≥30 days), opt-outs ≤10 business days, suppression list, no harvested lists. Max **$53,088/email** (2025). Well-defined & stable. (FTC)
- **TCPA (calls/texts/RVM):** **$500–$1,500/violation**, private right of action, no cap; cell marketing needs prior express (written) consent; scrub National DNC every 31 days + internal list; **RVM counts as a "call"** (FCC 22-85). Litigation **+112% YoY (2025)**; KW ~$40M, Realogy ~$20M settlements; **wholesalers flagged high-risk**.
- **Volatile/contested:** "one-to-one consent" rule **VACATED 1/24/2025** (11th Cir.) — many blogs wrong; revoke-by-any-reasonable-means in effect (≤10 business days), "revoke-all" delayed to ~4/11/2026; *Bradford* (5th Cir., 2/2026) allows oral consent (5th Cir. only — keep written). State mini-TCPAs (FL FTSA, TX SB 140 eff. 9/1/2025) stricter.

## 4. Lead sourcing
- **Signals:** tax-delinquent, pre-foreclosure/NOD, probate, vacant, absentee, **high-equity**, tired landlords, code violations, divorce/liens, expired, downsizing.
- **Data:** PropStream (~$99/mo, 160M props), BatchData/BatchLeads (data+skip+dialer; PropStream-owned 7/2025), DealMachine ($99–416, driving-for-dollars), ATTOM (API ~$95/mo, compliant), ListSource/CoreLogic (~$0.31/rec), free county records. **No Zillow/Redfin scraping.**
- **Skip trace:** ~70–90% "hit" but **right-party-contact** is the real metric (BatchData "76% RPC" = marketing); ~$0.07–$0.25/rec (bulk to ~$0.006–$0.02).
- **List-stacking** = prioritize 2+ list overlaps (tax-delinquent + absentee + high-equity + vacant).

## 5. Outreach, scripts, negotiation
- **Direct mail (cold):** **0.2–2%** response; $0.60–$0.90/piece; **~$2,500–$9,000/contract** (saturated metros higher). Cold call ~6.4% connect → ~2.3% appointment (lowest CPL, TCPA risk). SMS 15–30% on **warm** lists only. PPC CPL $30–66, exclusive seller leads $300+. (DMA, RealEstateSkills, vendor)
- **Script — qualify 5 axes:** condition, timeline, price, motivation, occupancy. **Listen > pitch.** Present offers as a range tied to as-is condition.
- **Negotiation:** anchor; sell **as-is / all-cash / fast close / no fees / no repairs**; objections = requests for clarity; sign while motivation is hot.

## 6. Contracts & closing
- PSA essentials (names, legal description, price, EMD, close date, title/escrow, contingencies). **EMD $500–$1,000** on sub-$200k (keep it small). **Inspection/contingency 7–21 days (commonly 14) = your escape hatch.** Clear **assignment clause**. Wholesale-friendly title/escrow.

## 7. Disposition & the buyer list (the moat)
- **Build from county cash-closings (no mortgage lien, last ~6 mo) = active buyers**; REIAs, auctions, online. Verify **proof of funds**.
- **Segment by buy-box:** area, price, beds, **repair tolerance** (cosmetic vs. heavy). Avoid "war zones" (no buyers) and high-end (hard to wholesale).
- **Match & move:** top **3–5 matched buyers, 24-hr exclusive**, then blast. Contract→assignment **7–30 days** (fast ~6). **JV/co-wholesaling** split commonly **50/50**.

## 8. KPIs & unit economics
- **~66 leads : 1 deal** (broad lists; REsimpli n=12,000+) / ~10:1 (exclusive). → ~66 leads → ~10–15 offers → 1 assignment.
- **CPL ~$5–$50; cost/deal ~$4,000–$9,000** marketing. Margin on ARV ~3–10%. Cycle ~30 days; **60–90 days to first deal**.

## 9. Scaling & automation (the one-operator edge)
- CRM: Podio $9–24/user; REsimpli $149–599 (all-in-one). Dialers $89–299. Offshore VAs $5–11.50/hr.
- A tech-driven solo replicates a big team's stack for a few hundred $/mo and wins on **speed-to-lead + buyer-list quality** — Parcel's exact thesis. First hires: **Acquisitions → Dispositions → Lead Manager.**

## 10. Failure modes & 90-day plan
**Top killers:** no buyer/can't assign; bad ARV/under-budgeted repairs; over-promising sellers (reputation+legal); thin margins/wrong price tier; no follow-up; licensing trouble. **Ethics:** no equity-stripping of distressed/elderly sellers, no contract-clouding of title (the behaviors new laws target).

**90 days:** Days 1–30 pick a legal-friendly market + attorney-reviewed contracts, set up data/skip/CRM, **build the buyer list first**, learn ARV/repairs. Days 31–60 consistent email-first outreach, make offers, sign first contract (small EMD, 14-day contingency). Days 61–90 assign via 24-hr top-buyer window → blast, track KPIs, automate/delegate the manual steps. Base case: **~66 leads, $4–9k marketing, ~$10k fee per deal.**

---

### Source reliability note
Primary law (FTC, FCC, court opinions, state statutes) and DMA/ATTOM datasets are high-confidence. Most response-rate, cost-per-deal, and fee figures come from vendor/CRM/guru blogs — directionally useful, self-interested, and 3–5× variant across sources. Plan with the **conservative** ends (~$10k fee, ~66 leads/deal, $4–9k/deal). The best-sampled stat is the 66:1 leads/deal (n=12,000+). Re-verify TCPA/state-law items (fast-moving) with counsel before any live send.
