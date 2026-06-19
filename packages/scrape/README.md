# @parcel/scrape

Self-hosted, Firecrawl-shaped web scrape engine — **no paid API**. Fetch → clean
HTML → markdown → schema/LLM extraction, behind a swappable `ScrapeEngine` seam.

- **Contract:** `ScrapeEngine` = `scrape` / `search` / `crawl` / `batchScrape` →
  `ScrapeResult { url, markdown, html?, json? }`. `MockScrapeEngine` is the keyless
  default; `SelfHostedScrapeEngine` opts in via `SCRAPE_ENGINE=selfhosted`.
- **Compliance (PRD §8.4):** the Zillow/Redfin/Trulia/Realtor denylist + robots.txt
  + per-host rate-limit are enforced at the engine boundary (`./compliance`), so no
  caller can bypass them. This is the single source of truth for the denylist.
- **Extraction:** `MockExtractor` (deterministic regex heuristics, default) or
  `AnthropicExtractor` (reuses `ANTHROPIC_API_KEY`), selected by `SCRAPE_EXTRACTOR`.
- **Consumers:** `services/sourcing` + `services/skiptrace` `ScrapeProvider`s
  (`PROPERTY_PROVIDER=scrape`). Talks to nothing else; pure library.
