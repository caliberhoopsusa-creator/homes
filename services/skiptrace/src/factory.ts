// Provider factory. Selects on PROPERTY_PROVIDER (mock | batchdata, default mock)
// — the same env var sourcing uses, so a deployment picks one real vendor stack.
// Default is the mock so nothing real fires without an explicit opt-in.
import type { SkipTraceProvider } from "./provider.js";
import { MockProvider } from "./providers/mock.js";
import { BatchDataProvider } from "./providers/batchdata.js";
import { FirecrawlProvider } from "./providers/firecrawl.js";
import { ScrapeProvider } from "./providers/scrape.js";

export type ProviderName = "mock" | "batchdata" | "firecrawl" | "scrape";

export interface FactoryOptions {
  /** Override the env selection. */
  provider?: ProviderName;
}

/** Build the configured skip-trace provider. */
export function createProvider(opts: FactoryOptions = {}): SkipTraceProvider {
  const name =
    opts.provider ?? (process.env.PROPERTY_PROVIDER as ProviderName) ?? "mock";

  switch (name) {
    case "batchdata":
      return new BatchDataProvider();
    case "firecrawl":
      return new FirecrawlProvider();
    case "scrape":
      return new ScrapeProvider();
    case "mock":
      return new MockProvider();
    default:
      throw new Error(
        `Unknown PROPERTY_PROVIDER "${name}" (expected "mock", "batchdata", "firecrawl", or "scrape")`,
      );
  }
}
