import type { DealStage } from "@parcel/types";
import { getDealViews, type DealView } from "@/lib/views";
import { DealCard } from "@/components/DealCard";
import { DashboardPanel } from "@/components/DashboardPanel";
import { RealtimeBoundary } from "@/components/RealtimeBoundary";

export const dynamic = "force-dynamic";

const STAGES: DealStage[] = [
  "Lead",
  "Contacted",
  "Under contract",
  "Assigned",
  "Closed",
];

export default async function PipelinePage() {
  const views = await getDealViews();
  const byStage = new Map<DealStage, DealView[]>(
    STAGES.map((s) => [s, []]),
  );
  for (const v of views) byStage.get(v.deal.stage)?.push(v);

  return (
    <div className="space-y-6">
      <RealtimeBoundary tables={["deals", "contracts"]} />
      <div>
        <h1 className="mb-3 text-xl font-semibold">Pipeline</h1>
        <DashboardPanel />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {STAGES.map((stage) => {
          const cards = byStage.get(stage) ?? [];
          return (
            <div key={stage} className="flex flex-col">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-700">
                  {stage}
                </h2>
                <span className="text-xs text-slate-400">{cards.length}</span>
              </div>
              <div className="flex flex-col gap-3 rounded-lg bg-slate-100/60 p-2">
                {cards.length === 0 && (
                  <p className="px-1 py-4 text-center text-xs text-slate-400">
                    No deals
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
    </div>
  );
}
