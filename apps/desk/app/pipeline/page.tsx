import type { DealStage } from "@parcel/types";
import Link from "next/link";
import { getDealViews, type DealView } from "@/lib/views";
import { DealCard } from "@/components/DealCard";
import { GuideCard } from "@/components/GuideCard";
import { RealtimeBoundary } from "@/components/RealtimeBoundary";

export const dynamic = "force-dynamic";

const STAGES: { stage: DealStage; blurb: string }[] = [
  { stage: "Lead", blurb: "New — no offer sent yet" },
  { stage: "Contacted", blurb: "Offer emailed, awaiting reply" },
  { stage: "Under contract", blurb: "Seller said yes" },
  { stage: "Assigned", blurb: "Buyer lined up" },
  { stage: "Closed", blurb: "Fee earned" },
];

export default async function PipelinePage() {
  const views = await getDealViews();
  const byStage = new Map<DealStage, DealView[]>(STAGES.map((s) => [s.stage, []]));
  for (const v of views) byStage.get(v.deal.stage)?.push(v);

  return (
    <div className="space-y-6">
      <RealtimeBoundary tables={["deals", "contracts"]} />
      <div>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ← Back to Home
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
          Pipeline
        </h1>
        <p className="text-sm text-slate-500">
          Every deal, grouped by where it is in the journey. Left to right = lead to payday.
        </p>
      </div>

      {views.length === 0 ? (
        <GuideCard
          eyebrow="Pipeline is empty"
          title="No deals are moving yet."
          body="Deals land here once you start working a lead. Find some properties, email the owners, and the first replies become deals you can track across these columns."
          cta={{ label: "Browse leads to work", href: "/leads" }}
        />
      ) : (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {STAGES.map(({ stage, blurb }) => {
          const cards = byStage.get(stage) ?? [];
          return (
            <div key={stage} className="flex flex-col">
              <div className="mb-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-800">{stage}</h2>
                  <span className="rounded-full bg-slate-200 px-2 text-xs font-medium text-slate-600">
                    {cards.length}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">{blurb}</p>
              </div>
              <div className="flex flex-col gap-3 rounded-xl bg-slate-100/70 p-2">
                {cards.length === 0 && (
                  <p className="px-1 py-4 text-center text-xs text-slate-400">
                    Nothing here yet
                  </p>
                )}
                {cards.map((v) => (
                  <DealCard
                    key={v.deal.id}
                    deal={v.deal}
                    property={v.property}
                    underwrite={v.underwrite}
                    assignedBuyer={v.assignedBuyer}
                    contract={v.contract}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
