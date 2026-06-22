// A consistent one-line "what to do next" cue for the top of a page. Quiet by
// default, but visually distinct so the eye lands on it — the assistant nudging
// you toward the next action without clutter.
export function NextHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-1.5 text-sm text-slate-700">
      <span aria-hidden className="text-blue-600">
        →
      </span>
      <span>
        <span className="font-semibold text-blue-700">Next: </span>
        {children}
      </span>
    </p>
  );
}
