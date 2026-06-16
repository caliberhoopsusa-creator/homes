// Reply intent classification. The classifier maps a raw inbound email body to
// the ReplyIntent enum + a confidence. Default is a deterministic keyword
// classifier (no key, fully testable); the Anthropic impl is the production path.
import type { ReplyIntent } from "@parcel/types";
import {
  ambientEnv,
  ambientFetch,
  type EnvLike,
  type FetchLike,
} from "./env.js";

export interface IntentResult {
  intent: ReplyIntent;
  confidence: number;
}

export interface IntentClassifier {
  classify(rawText: string): Promise<IntentResult>;
}

// ── Mock (default) ───────────────────────────────────────────────────────────
// Ordered rules: opt-outs and negatives are checked BEFORE "interested" so that
// "not interested" / "remove me" never read as a positive intent.
const RULES: Array<{ intent: ReplyIntent; re: RegExp; confidence: number }> = [
  {
    intent: "do_not_contact",
    re: /\b(stop|unsubscribe|remove me|take me off|do ?n[o']?t (ever )?contact|don'?t email|leave me alone|opt[- ]?out|lose my (number|email))\b/i,
    confidence: 0.97,
  },
  {
    intent: "not_now",
    re: /\b(not (interested|selling|for sale)|already sold|no thanks?|not right now|maybe later|pass\b)/i,
    confidence: 0.85,
  },
  {
    intent: "interested",
    re: /\b(yes|interested|cash offer|how much|what.{0,12}offer|i'?d take|i would take|make.{0,6}offer|send.{0,6}offer|sounds good|let'?s talk|call me|what'?s your (number|offer))\b/i,
    confidence: 0.9,
  },
  {
    intent: "maybe",
    re: /\b(maybe|possibly|it depends|tell me more|more info|what address|which (house|property)|considering)\b/i,
    confidence: 0.7,
  },
];

export class MockClassifier implements IntentClassifier {
  async classify(rawText: string): Promise<IntentResult> {
    const text = (rawText ?? "").trim();
    for (const rule of RULES) {
      if (rule.re.test(text)) return { intent: rule.intent, confidence: rule.confidence };
    }
    return { intent: "unknown", confidence: 0.3 };
  }
}

// ── Anthropic (production) ───────────────────────────────────────────────────
const VALID: ReplyIntent[] = [
  "interested",
  "maybe",
  "not_now",
  "do_not_contact",
  "unknown",
];

export interface AnthropicClassifierOptions {
  env?: EnvLike;
  fetchImpl?: FetchLike;
}

export class AnthropicClassifier implements IntentClassifier {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly fetchImpl: FetchLike;

  constructor(opts: AnthropicClassifierOptions = {}) {
    const env = opts.env ?? ambientEnv();
    const key = env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new Error(
        "ANTHROPIC_API_KEY is required for AnthropicClassifier (set CLASSIFIER=mock to run keyless).",
      );
    }
    this.apiKey = key;
    this.model = env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
    this.fetchImpl = opts.fetchImpl ?? ambientFetch();
  }

  async classify(rawText: string): Promise<IntentResult> {
    const res = await this.fetchImpl("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 64,
        system:
          "Classify a property owner's email reply to a cash-offer outreach. " +
          'Respond ONLY with JSON: {"intent": one of ' +
          '["interested","maybe","not_now","do_not_contact","unknown"], ' +
          '"confidence": 0..1}. "interested" = wants an offer/price or to talk. ' +
          '"do_not_contact" = asks to stop/remove/unsubscribe.',
        messages: [{ role: "user", content: rawText }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic classify failed: ${res.status}`);

    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = data.content?.find((b) => b.type === "text")?.text ?? "";
    return parseIntentJson(text);
  }
}

/** Parse the model's JSON, clamped to the enum. Exported for testing. */
export function parseIntentJson(text: string): IntentResult {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return { intent: "unknown", confidence: 0.3 };
  try {
    const obj = JSON.parse(match[0]) as { intent?: string; confidence?: number };
    const intent = (VALID as string[]).includes(obj.intent ?? "")
      ? (obj.intent as ReplyIntent)
      : "unknown";
    const confidence =
      typeof obj.confidence === "number"
        ? Math.max(0, Math.min(1, obj.confidence))
        : 0.5;
    return { intent, confidence };
  } catch {
    return { intent: "unknown", confidence: 0.3 };
  }
}

/** Factory: CLASSIFIER=mock (default) | anthropic. */
export function makeClassifier(env: EnvLike = ambientEnv()): IntentClassifier {
  return (env.CLASSIFIER ?? "mock") === "anthropic"
    ? new AnthropicClassifier({ env })
    : new MockClassifier();
}
