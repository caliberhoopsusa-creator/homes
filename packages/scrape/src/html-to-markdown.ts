// Pure, dependency-free HTML → markdown. Not a full DOM parser — a pragmatic
// converter that strips boilerplate (script/style/nav/header/footer), picks the
// densest main-content region, and emits readable markdown for humans + LLMs.
// Deterministic and fully unit-testable (no network, no DOM).

/** Remove whole elements (incl. content) by tag name. */
function stripElements(html: string, tags: string[]): string {
  let out = html;
  for (const tag of tags) {
    const re = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, "gi");
    out = out.replace(re, " ");
    // Self-closing / unclosed variants.
    out = out.replace(new RegExp(`<${tag}\\b[^>]*/?>`, "gi"), " ");
  }
  return out;
}

/** Decode the handful of HTML entities that actually show up in text. */
function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)));
}

/** Extract the <title> text, if any. */
export function extractTitle(html: string): string | undefined {
  const m = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (!m) return undefined;
  const t = decodeEntities(m[1] ?? "").replace(/\s+/g, " ").trim();
  return t || undefined;
}

/**
 * Pick the main content: prefer <main> or <article>, else fall back to <body>,
 * else the whole document. Keeps the converter focused on real content.
 */
function pickMain(html: string): string {
  for (const tag of ["main", "article"]) {
    const m = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "i").exec(html);
    if (m && m[1] && m[1].trim().length > 0) return m[1];
  }
  const body = /<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(html);
  return body?.[1] ?? html;
}

/** Convert a cleaned HTML fragment to markdown-ish plain text. */
function fragmentToMarkdown(fragment: string): string {
  let s = fragment;

  // Headings.
  s = s.replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_, lvl: string, inner: string) => {
    const hashes = "#".repeat(Number(lvl));
    return `\n\n${hashes} ${inner.replace(/<[^>]+>/g, " ").trim()}\n\n`;
  });

  // Links: keep text + target.
  s = s.replace(
    /<a\b[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_, href: string, text: string) => {
      const label = text.replace(/<[^>]+>/g, " ").trim();
      return label ? `[${label}](${href})` : "";
    },
  );

  // List items.
  s = s.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_, inner: string) => {
    return `\n- ${inner.replace(/<[^>]+>/g, " ").trim()}`;
  });

  // Block-level breaks.
  s = s.replace(/<(\/p|br|\/div|\/tr|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, "\n");

  // Drop any remaining tags.
  s = s.replace(/<[^>]+>/g, " ");

  // Decode + tidy whitespace.
  s = decodeEntities(s);
  s = s
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return s;
}

/** Full pipeline: raw HTML → clean markdown (main content only). */
export function htmlToMarkdown(html: string): string {
  const stripped = stripElements(html, [
    "script",
    "style",
    "noscript",
    "nav",
    "header",
    "footer",
    "aside",
    "form",
    "svg",
    "iframe",
  ]);
  const main = pickMain(stripped);
  return fragmentToMarkdown(main);
}
