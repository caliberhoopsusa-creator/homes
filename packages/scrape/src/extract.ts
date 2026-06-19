// Structured extraction — turn a scraped page into schema-shaped JSON.
//
// Behind the Extractor seam (§7.4): the MockExtractor is deterministic and the
// keyless default; the AnthropicExtractor opts in via ANTHROPIC_API_KEY. Sourcing
// and skip-trace ask for the fields they need via an ExtractSchema; the engine
// runs the configured extractor over the page markdown.
import type { ExtractSchema } from "./engine.js";

export interface Extractor {
  /** Extract schema-shaped fields from page text. Returns {} when nothing matches. */
  extract(text: string, schema: ExtractSchema): Promise<Record<string, unknown>>;
}

// ── Mock: deterministic heuristics over the markdown (no network) ────────────

/** Lightweight regexes for the field names our funnel actually asks for. */
const PATTERNS: Record<string, RegExp> = {
  email: /[\w.+-]+@[\w-]+\.[\w.-]+/,
  phone: /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,
  zip: /\b\d{5}(?:-\d{4})?\b/,
  year_built: /\b(?:built|year built)[^\d]{0,10}(\d{4})\b/i,
  beds: /\b(\d+)\s*(?:bed|bd|br)\b/i,
  baths: /\b(\d+(?:\.\d)?)\s*(?:bath|ba)\b/i,
  sqft: /\b([\d,]{3,})\s*(?:sq\.?\s?ft|sqft|square feet)\b/i,
  est_value: /(?:est(?:imate|imated)?\.?\s*value|avm)[^\d$]{0,10}\$?([\d,]+)/i,
  asking: /(?:asking|list(?:ed)?\s*price|price)[^\d$]{0,10}\$?([\d,]+)/i,
};

function coerce(type: string, raw: string): unknown {
  if (type === "number") {
    const n = Number(raw.replace(/[,$\s]/g, ""));
    return Number.isFinite(n) ? n : undefined;
  }
  return raw.trim();
}

export class MockExtractor implements Extractor {
  async extract(text: string, schema: ExtractSchema): Promise<Record<string, unknown>> {
    const out: Record<string, unknown> = {};
    for (const [field, def] of Object.entries(schema.properties)) {
      const re = PATTERNS[field];
      if (!re) continue;
      const m = re.exec(text);
      if (!m) continue;
      const captured = m[1] ?? m[0];
      const value = coerce(def.type, captured);
      if (value !== undefined && value !== "") out[field] = value;
    }
    return out;
  }
}

// ── Anthropic: real, schema-guided extraction (opt-in, env key) ──────────────

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

export interface AnthropicExtractorOptions {
  apiKey?: string;
  model?: string;
}

export class AnthropicExtractor implements Extractor {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(opts: AnthropicExtractorOptions = {}) {
    const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "AnthropicExtractor: ANTHROPIC_API_KEY is not set. " +
          "Set it in the environment or use SCRAPE_EXTRACTOR=mock.",
      );
    }
    this.apiKey = apiKey;
    this.model = opts.model ?? process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001";
  }

  async extract(text: string, schema: ExtractSchema): Promise<Record<string, unknown>> {
    const fields = Object.entries(schema.properties)
      .map(([k, v]) => `- ${k} (${v.type}${v.items ? `<${v.items.type}>` : ""})`)
      .join("\n");
    const prompt =
      `Extract the following fields from the page content as strict JSON. ` +
      `Use null for any field you cannot find. Output ONLY the JSON object.\n\n` +
      `Fields:\n${fields}\n\nPage content:\n${text.slice(0, 12000)}`;

    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      throw new Error(`AnthropicExtractor: ${res.status} ${res.statusText} from Anthropic`);
    }

    const json = (await res.json()) as { content?: Array<{ text?: string }> };
    const raw = json.content?.[0]?.text ?? "{}";
    return parseJsonObject(raw);
  }
}

/** Pull the first JSON object out of a model response, tolerant of fences. */
function parseJsonObject(raw: string): Record<string, unknown> {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return {};
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      // Drop nulls so callers see only found fields.
      return Object.fromEntries(
        Object.entries(parsed as Record<string, unknown>).filter(([, v]) => v != null),
      );
    }
  } catch {
    /* fall through */
  }
  return {};
}

/** Select the extractor from SCRAPE_EXTRACTOR (mock | anthropic, default mock). */
export function createExtractor(name?: string): Extractor {
  const selected = name ?? process.env.SCRAPE_EXTRACTOR ?? "mock";
  switch (selected) {
    case "anthropic":
      return new AnthropicExtractor();
    case "mock":
      return new MockExtractor();
    default:
      throw new Error(`Unknown SCRAPE_EXTRACTOR "${selected}" (expected "mock" or "anthropic")`);
  }
}
