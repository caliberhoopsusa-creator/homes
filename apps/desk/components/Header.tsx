"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RadiusPullButton } from "./RadiusPullButton";
import { OutreachButton } from "./OutreachButton";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/leads", label: "Leads" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/contracts", label: "Contracts" },
  { href: "/buyers", label: "Buyers" },
  { href: "/dashboard", label: "Money" },
  { href: "/setup", label: "Setup" },
];

// Client header so we can highlight the current page. The live/demo badge is
// passed in from the server layout (env is server-only).
export function Header({ live }: { live: boolean }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight text-slate-900">
          Parcel<span className="text-blue-600"> desk</span>
        </Link>
        <nav className="flex gap-1 text-sm">
          {NAV.map((n) => {
            const active = isActive(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors duration-150 ${
                  active
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
              live ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
            }`}
            title={
              live
                ? "Connected to your live database — these are real records."
                : "Demo mode — sample data, nothing is saved."
            }
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${live ? "bg-green-500" : "bg-amber-500"}`}
            />
            {live ? "Live data" : "Demo data"}
          </span>
          <RadiusPullButton />
          <OutreachButton />
        </div>
      </div>
    </header>
  );
}
