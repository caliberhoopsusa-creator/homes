// Engine factory. Selects the implementation from SCRAPE_ENGINE
// (mock | selfhosted, default mock) so nothing real fires without an explicit
// opt-in (§7.4). The mock keeps the whole funnel runnable keyless.
import type { ScrapeEngine } from "./engine.js";
import { MockScrapeEngine } from "./engine/mock.js";
import { SelfHostedScrapeEngine } from "./engine/self-hosted.js";

export type EngineName = "mock" | "selfhosted";

export interface CreateEngineOptions {
  /** Override the env selection. */
  engine?: EngineName;
}

/** Build the configured scrape engine. */
export function createScrapeEngine(opts: CreateEngineOptions = {}): ScrapeEngine {
  const name = opts.engine ?? (process.env.SCRAPE_ENGINE as EngineName) ?? "mock";
  switch (name) {
    case "selfhosted":
      return new SelfHostedScrapeEngine();
    case "mock":
      return new MockScrapeEngine();
    default:
      throw new Error(`Unknown SCRAPE_ENGINE "${name}" (expected "mock" or "selfhosted")`);
  }
}
