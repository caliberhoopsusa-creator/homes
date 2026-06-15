// Provider factory. Selects the implementation from PROPERTY_PROVIDER
// (mock | batchdata, default mock) and wraps it in the cache/rate-limit layer.
// Default is the mock so nothing real fires without an explicit opt-in.
import type { PropertyProvider } from "./provider.js";
import { MockProvider } from "./providers/mock.js";
import { BatchDataProvider } from "./providers/batchdata.js";
import { CachingProvider, type CacheOptions } from "./cache.js";

export type ProviderName = "mock" | "batchdata";

export interface FactoryOptions {
  /** Override the env selection. */
  provider?: ProviderName;
  /** Cache/rate-limit options for the wrapper. */
  cache?: CacheOptions;
}

/** Build the configured provider, wrapped in the caching/rate-limit layer. */
export function createProvider(opts: FactoryOptions = {}): PropertyProvider {
  const name =
    opts.provider ?? (process.env.PROPERTY_PROVIDER as ProviderName) ?? "mock";

  let base: PropertyProvider;
  switch (name) {
    case "batchdata":
      base = new BatchDataProvider();
      break;
    case "mock":
      base = new MockProvider();
      break;
    default:
      throw new Error(
        `Unknown PROPERTY_PROVIDER "${name}" (expected "mock" or "batchdata")`,
      );
  }

  return new CachingProvider(base, opts.cache);
}
