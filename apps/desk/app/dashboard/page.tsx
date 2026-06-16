import { DashboardPanel } from "@/components/DashboardPanel";
import { RealtimeBoundary } from "@/components/RealtimeBoundary";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <div className="space-y-4">
      <RealtimeBoundary tables={["deals", "contracts"]} />
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <p className="max-w-2xl text-sm text-slate-500">
        Pace toward the $10k/month goal (~one $12k assignment). Money-in-motion
        sums fee potential on deals that cleared the human gate this month;
        total deal count paces the Montana broker-license line.
      </p>
      <DashboardPanel />
    </div>
  );
}
