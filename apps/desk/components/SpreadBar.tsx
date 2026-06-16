import { underwrite, type UnderwriteResult } from "@parcel/underwriting";
import { usd, VERDICT_CLASS, VERDICT_LABEL } from "@/lib/format";

// Visual spread bar. Math comes ONLY from the canonical underwrite() so the
// desk can never drift from the engine. The bar lays out, across ARV*rulePct:
//   [ repairs | your fee target | the rest ]  with markers for asking & MAO.
export function SpreadBar({
  arv,
  repairs,
  asking,
  rulePct,
  feeTarget,
}: {
  arv: number;
  repairs: number;
  asking: number;
  rulePct?: number;
  feeTarget?: number;
}) {
  const r: UnderwriteResult = underwrite({
    arv,
    repairs,
    asking,
    rulePct,
    feeTarget,
  });

  // Scale the bar to ARV (the gross value the deal is carved out of).
  const span = Math.max(arv, 1);
  const pct = (n: number) => `${Math.max(0, Math.min(100, (n / span) * 100))}%`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${VERDICT_CLASS[r.verdict]}`}
        >
          {VERDICT_LABEL[r.verdict]}
        </span>
        <span>
          Fee potential:{" "}
          <strong
            className={r.feePotential >= 0 ? "text-green-700" : "text-red-700"}
          >
            {usd(r.feePotential)}
          </strong>
        </span>
        <span className="text-slate-500">
          Buyer ceiling {usd(r.buyerCeiling)} · Your MAO {usd(r.yourMao)}
        </span>
      </div>

      <div className="relative h-8 w-full overflow-hidden rounded bg-slate-100 ring-1 ring-slate-200">
        {/* repairs band */}
        <div
          className="absolute inset-y-0 left-0 bg-slate-300"
          style={{ width: pct(r.repairs) }}
          title={`Repairs ${usd(r.repairs)}`}
        />
        {/* spread to buyer ceiling */}
        <div
          className="absolute inset-y-0 bg-green-200"
          style={{ left: pct(r.repairs), width: pct(r.buyerCeiling - r.repairs) }}
          title={`Buyer ceiling ${usd(r.buyerCeiling)}`}
        />
        {/* asking marker */}
        <Marker left={pct(asking)} color="bg-slate-900" label="Ask" />
        {/* MAO marker */}
        <Marker left={pct(r.yourMao)} color="bg-blue-600" label="MAO" />
        {/* ceiling marker */}
        <Marker left={pct(r.buyerCeiling)} color="bg-green-700" label="Ceil" />
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs text-slate-600 sm:grid-cols-4">
        <Fact label="ARV" value={usd(r.arv)} />
        <Fact label="Repairs" value={usd(r.repairs)} />
        <Fact label="Asking" value={usd(r.asking)} />
        <Fact label={`Rule ${Math.round(r.rulePct * 100)}%`} value={`fee target ${usd(r.feeTarget)}`} />
      </div>
    </div>
  );
}

function Marker({
  left,
  color,
  label,
}: {
  left: string;
  color: string;
  label: string;
}) {
  return (
    <div className="absolute inset-y-0" style={{ left }}>
      <div className={`h-full w-0.5 ${color}`} />
      <span className="absolute -top-0.5 left-1 text-[10px] font-medium text-slate-700">
        {label}
      </span>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-slate-400">{label}: </span>
      <span className="font-medium text-slate-800">{value}</span>
    </div>
  );
}
