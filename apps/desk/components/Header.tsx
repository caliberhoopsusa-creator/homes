import Link from "next/link";
import { RadiusPullButton } from "./RadiusPullButton";
import { isLive } from "@/lib/data";

const NAV = [
  { href: "/", label: "Pipeline" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/buyers", label: "Buyers" },
  { href: "/contracts", label: "Contracts" },
];

export function Header() {
  const live = isLive();
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Parcel<span className="text-green-600"> desk</span>
        </Link>
        <nav className="flex gap-4 text-sm">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="text-slate-600 hover:text-slate-900"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span
            className={`rounded px-2 py-0.5 text-xs font-medium ${
              live
                ? "bg-green-100 text-green-700"
                : "bg-slate-100 text-slate-500"
            }`}
            title={
              live
                ? "Connected to Supabase"
                : "Running on local fixtures (no Supabase env)"
            }
          >
            {live ? "live" : "fixtures"}
          </span>
          <RadiusPullButton />
        </div>
      </div>
    </header>
  );
}
