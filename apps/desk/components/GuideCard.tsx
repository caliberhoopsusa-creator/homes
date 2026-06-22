import Link from "next/link";

// A guiding empty state: tells the user exactly what's going on, what to do next
// and why — with the action right there. Used wherever a page/list is empty so a
// beginner is never staring at a blank screen wondering what to do.
export function GuideCard({
  eyebrow,
  title,
  body,
  cta,
}: {
  /** Small label, e.g. "Nothing here yet". */
  eyebrow?: string;
  /** The headline — what to do, in plain words. */
  title: string;
  /** One or two sentences: why, and how. */
  body: string;
  /** Optional action button. `note` is shown instead when the action lives elsewhere (e.g. the top bar). */
  cta?: { label: string; href: string } | { note: string };
}) {
  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-6">
      {eyebrow && (
        <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">
          {eyebrow}
        </p>
      )}
      <p className="mt-1 text-xl font-semibold text-slate-900">{title}</p>
      <p className="mt-1 max-w-prose text-sm leading-relaxed text-slate-600">{body}</p>
      {cta && "href" in cta && (
        <Link
          href={cta.href}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          {cta.label} →
        </Link>
      )}
      {cta && "note" in cta && (
        <p className="mt-3 text-sm font-medium text-blue-700">{cta.note}</p>
      )}
    </div>
  );
}
