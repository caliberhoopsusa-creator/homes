// Personalizer (PRD §6.4). Fills ONLY 1–2 REAL tokens (address, neighborhood).
// It must never invent familiarity ("Hi John, hope the kids are well"). The
// contract is intentionally narrow: substitute known tokens into a template.
//
// MockPersonalizer is the default (pure token substitution). AnthropicPersonalizer
// is the real shape (env-keyed, faithful Messages API mapping) and throws if the
// key is missing. It does NOT need to run live.
import type { EnvLike, FetchLike } from "./env.js";
import { ambientEnv, ambientFetch } from "./env.js";

export interface Personalizer {
  /**
   * Substitute the provided real tokens into a template. Implementations MUST
   * only use the supplied tokens and MUST NOT fabricate personal details.
   */
  fill(template: string, tokens: Record<string, string>): string;
}

/** Replace every {{token}} in `template` from `tokens`. Unknown tokens stay literal. */
function substitute(template: string, tokens: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (whole, key: string) => {
    const v = tokens[key];
    return v === undefined ? whole : v;
  });
}

/** Default: deterministic token substitution, no network, no model. */
export class MockPersonalizer implements Personalizer {
  fill(template: string, tokens: Record<string, string>): string {
    return substitute(template, tokens);
  }
}

export interface AnthropicPersonalizerOptions {
  apiKey?: string;
  model?: string;
  /** Injectable for tests; defaults to global fetch. */
  fetchImpl?: FetchLike;
}

/**
 * Real-shape Anthropic personalizer. Uses the Messages API to lightly rephrase a
 * template while constraining it to the real tokens only. Falls back to plain
 * substitution semantics for the token guarantee. Throws if the key is missing.
 *
 * Not exercised live in tests — `fill` here is synchronous to satisfy the shared
 * `Personalizer` contract; the async model call lives in `fillAsync`.
 */
export class AnthropicPersonalizer implements Personalizer {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly fetchImpl: FetchLike;

  constructor(opts: AnthropicPersonalizerOptions = {}) {
    const env = ambientEnv();
    const apiKey = opts.apiKey ?? env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "AnthropicPersonalizer: ANTHROPIC_API_KEY is required (no key in source).",
      );
    }
    this.apiKey = apiKey;
    this.model = opts.model ?? env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
    this.fetchImpl = opts.fetchImpl ?? ambientFetch();
  }

  /** Synchronous token fill (matches the Personalizer contract). */
  fill(template: string, tokens: Record<string, string>): string {
    return substitute(template, tokens);
  }

  /**
   * Real-shape Anthropic Messages API call. The model only sees the template and
   * the real tokens, and is told to use ONLY those facts (no invented familiarity).
   */
  async fillAsync(
    template: string,
    tokens: Record<string, string>,
  ): Promise<string> {
    const seeded = substitute(template, tokens);
    const res = await this.fetchImpl("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 400,
        system:
          "You lightly polish a short real-estate outreach email. Use ONLY the " +
          "facts in the message. Never invent names, relationships, or personal " +
          "details. Keep exactly one call-to-action. Return only the email body.",
        messages: [{ role: "user", content: seeded }],
      }),
    });
    if (!res.ok) {
      throw new Error(`AnthropicPersonalizer: HTTP ${res.status}`);
    }
    const json = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = json.content?.find((c) => c.type === "text")?.text;
    return text ?? seeded;
  }
}

export type PersonalizerKind = "mock" | "anthropic";

/** Factory on EMAIL/personalizer env. Defaults to the mock. */
export function makePersonalizer(
  env: EnvLike = ambientEnv(),
): Personalizer {
  const kind = (env.PERSONALIZER ?? "mock") as PersonalizerKind;
  if (kind === "anthropic") return new AnthropicPersonalizer();
  return new MockPersonalizer();
}
