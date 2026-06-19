# packages/scrape (`@parcel/scrape`) — agent rules

Shared library: a self-hosted, Firecrawl-like crawl + structured-extraction engine
(no paid API). Import shared types from `@parcel/types` only. This is a pure library —
it never touches the DB and is not a service.

- Engines sit behind the `ScrapeEngine` interface — `MockScrapeEngine` is the keyless
  default; `SelfHostedScrapeEngine` opts in via `SCRAPE_ENGINE=selfhosted`. No secrets
  in source; the optional Anthropic extractor reads `ANTHROPIC_API_KEY` from env.
- **COMPLIANCE (non-negotiable, PRD §8.4):** `compliance.ts` is the single source of
  truth for the Zillow/Redfin/Trulia/Realtor denylist. Every network path MUST call
  `assertPermitted`/`isPermitted` before fetching. Honor robots.txt + rate-limit. Never
  weaken or remove a denied domain.
- `fetch` is injected (default global) so engines are unit-testable with no live network.
- Keep PII out of logs (skip-trace extraction runs through here).
