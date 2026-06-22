import { GLOSSARY, type GlossaryKey } from "@/lib/glossary";

// Inline jargon with a plain-English explanation. Renders the term with a dotted
// underline + a help cursor; the definition shows on hover AND is available to
// screen readers / keyboard via the native title + an aria-label. No JS, no
// portal — works in server components, costs nothing.
export function Term({
  k,
  children,
}: {
  k: GlossaryKey;
  /** Override the visible text (defaults to the glossary term). */
  children?: React.ReactNode;
}) {
  const entry = GLOSSARY[k];
  return (
    <abbr
      title={entry.plain}
      aria-label={`${entry.term}: ${entry.plain}`}
      tabIndex={0}
      className="cursor-help font-medium text-slate-700 underline decoration-dotted decoration-slate-400 underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      style={{ textDecorationThickness: "1px" }}
    >
      {children ?? entry.term}
    </abbr>
  );
}
