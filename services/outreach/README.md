# @parcel/outreach

Compliant 3-touch email sequence (day 0/3/7, one CTA each) against owners of
*clearing* deals (verdict='clear'). Output: `messages` rows + sends via an
injected `EmailProvider`. Every send carries a CAN-SPAM footer (physical mailing
address + per-owner one-click unsubscribe); suppressed owners are never messaged.
Externals are behind interfaces — `makeProvider` (mock|sendgrid) and
`makePersonalizer` (mock|anthropic) default to mocks; `runCampaign(deps, opts)`
enforces the suppression gate, the daily-cap ramp, and queued→sent logging.
