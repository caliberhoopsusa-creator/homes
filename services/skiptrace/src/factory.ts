// Provider factory. Selects on PROPERTY_PROVIDER (mock | batchdata, default mock)
// — the same env var sourcing uses, so a deployment picks one real vendor stack.
// Default is the mock so nothing real fires without an explicit opt-in.
import type { SkipTraceProvider } from "./provider.js";
import { MockProvider } from "./providers/mock.js";
import { BatchDataProvider } from "./providers/batchdata.js";
import { FirecrawlProvider } from "./providers/firecrawl.js";

export type ProviderName = "mock" | "batchdata" | "firecrawl" | "county";

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
    case "mock":
    // The free county source has no bundled skip-trace vendor, so owner lookup
    // falls back to the mock finder. Swap in a real skip-trace integration when
    // wired (county records do carry the owner's mailing address for mail-based outreach).
    case "county":
      return new MockProvider();
    default:
      throw new Error(
        `Unknown PROPERTY_PROVIDER "${name}" (expected "mock", "batchdata", "firecrawl", or "county")`,
      );
  }
}
