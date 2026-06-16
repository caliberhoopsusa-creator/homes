# Montana Wholesaling — Legal Brief (the hard gate)

> Research synthesis (deep-research, mid-2026) on whether/how wholesaling is legal in
> Montana, to prepare for the **required Montana RE-attorney review** (CLAUDE.md #5, PRD §8.3).
> **⚠️ NOT legal advice, and NOT a substitute for the attorney review.** Every statutory quote
> below came via search-engine extraction of official pages (the fetcher was 403-blocked) —
> **verify the live text at leg.mt.gov before relying on it.**

## Bottom line
- **Wholesaling via contract assignment is legal in Montana.** There is **no Montana statute
  banning, licensing, registering, or specially regulating wholesalers** — Montana did **not**
  follow Illinois / Oklahoma / South Carolina / Oregon (which passed wholesaling-specific laws
  in 2023–2025). As of June 2026, none passed in the 2023 (68th) or 2025 (69th) sessions.
- **The real risk is the unlicensed-broker line**, not a wholesaling ban. The project's
  non-negotiable #5 ("market an offer to buy, never the property for sale") is **legally
  well-founded** — it's the exact line between the licensing exemption and broker activity.

## The statutory framework (MCA Title 37, Ch. 51)
- **37-51-102 — "Broker" definition:** reaches anyone who, **"for another or for valuable
  consideration … negotiates … the sale, purchase, exchange, or lease of real estate,"** and
  one who **"makes the advertising, sale … or other real estate information available by public
  display to potential buyers."** The load-bearing phrase is **"for another."**
- **37-51-301 — License required:** unlawful to act as/advertise as a broker without a license,
  and **"any single act"** within the broker definition is enough — **no "only did it once"
  defense.** Note it covers **advertising** "to the public," so buyer-facing *marketing copy*
  can be the triggering act, before any closing.
- **37-51-103 — Owner/principal exemption:** licensing doesn't apply to a person who **"as owner
  or lessor, performs any acts with reference to property owned or leased by the person."**
  Exemption is lost if you act as attorney-in-fact **"regularly or consistently … for
  compensation."**
- **28-2-206 — Contracts are assignable:** an assignment "transfers all the rights of the
  assignor." → your purchase agreement must **permit assignment** (use "Buyer **and/or assigns**").

## The wholesaling theory — and its one real gap
**Theory:** signing a purchase contract gives you an **equitable interest** (equitable
conversion); assigning that contract disposes of **your own** interest as a **principal**, so
you're outside "for another" (37-51-102) and not brokering.

**⚠️ The gap (flag this to the attorney):** 37-51-103 says **"as owner or lessor."** A holder of
*equitable interest* under a contract is arguably **not yet the legal "owner."** No Montana
statute, regulation, BRR opinion, or case was found that **expressly blesses equitable interest
as satisfying the exemption** — so treat the theory as **prevailing practice, not a confirmed
safe harbor.** This unresolved question is exactly why the attorney review is required.

## What keeps you on the right side (maps to the build)
1. **Get the property under a written, assignable contract BEFORE any buyer-facing marketing.**
   Marketing first, contracting second, collapses the exemption. (Sequence matters.)
2. **Market only your right to buy / the offer — never the property for sale.** Don't advertise
   the address/photos as if listing it. (This is Parcel's outreach + MT-broker-line rule.)
3. **Double close** (actually take title, then resell) is the **most defensive** structure — it
   makes you an unambiguous "owner" under 37-51-103, removing the equitable-interest ambiguity.
   Use it when the assignment route feels exposed.
4. **Disclose the assignment** to seller and buyer; title companies often require it.
5. **Montana closes through TITLE/ESCROW companies, not attorneys** — line up a
   **wholesale-friendly title company** that understands assignment + double-close.

## Seller-disclosure law (applies when YOU are the seller)
**MCA 70-20-501/502/505** (Ch. 375, Laws of 2023; eff. ~Jan 1 2024) — a **general** residential
seller-disclosure law (not wholesaler-specific). When the wholesaler/assignor transfers as the
seller, they must disclose **adverse material facts of actual knowledge** before/at contract.
**Exemptions include foreclosure and court-ordered transfers** — relevant since distressed
properties are the sourcing target. (Corrects the old "Montana has no statutory disclosure form"
belief — that changed in 2024.) The Montana Association of Realtors publishes a standard form.

## Enforcement
Administered by the **Board of Realty Regulation (BRR)** under DLI. Unlicensed practice (MCA
**37-1-317/318**) can draw **injunction, contempt, monetary penalties, and possible criminal
referral**. **37-51-321** bars paying a commission to an unlicensed person (watch fee framing).
> The popular "Montana actively enforces / highest rate of legal challenges" claim traces only
> to a guru blog and is **unverified** — no Montana enforcement action against a wholesaler was
> found. Don't over- or under-weight it.

## Checklist for the attorney review (bring this)
- [ ] Confirm the **assignment/purchase-agreement template** is enforceable in MT and permits assignment.
- [ ] Opine on whether **equitable interest satisfies the 37-51-103 "owner" exemption**, or whether
      to **default to double-close** for safety.
- [ ] Approve **outreach + buyer-facing copy** against the 37-51-102 "public display/advertising" prong.
- [ ] Confirm **seller-disclosure (70-20-502)** handling and which distressed transfers are exempt.
- [ ] Confirm **fee structure** doesn't look like an unlicensed commission (37-51-321).
- [ ] Then: flip `CONTRACT_TEMPLATE_REVIEWED=true`.

### Key sources
MCA 37-51-102 (law.justia.com/codes/montana/title-37/chapter-51/part-1/section-37-51-102) ·
37-51-103 & 37-51-301 (archive.legmt.gov) · 28-2-206 (archive.legmt.gov) · 70-20-502
(mca.legmt.gov; Justia; Nolo) · BRR (boards.bsd.dli.mt.gov/realty-regulation) · 2025 Legislative
Review (archive.legmt.gov) · MAR 2025 bills (montanarealtors.org/advocacy/2025-legislative-bills).
*All statutory quotes via search extraction — verify against leg.mt.gov primary text.*
