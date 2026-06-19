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
    <header className="sticky top-0 z-30 border-b border-[var(--hud-line-2)] bg-[rgba(6,10,15,0.82)] backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link
          href="/"
          className="font-[family-name:var(--font-display)] text-lg font-bold uppercase tracking-[0.18em] text-[var(--hud-text)] [text-shadow:0_0_18px_rgba(79,216,238,0.4)]"
        >
          Parcel<span className="text-[var(--hud-cyan)]"> // desk</span>
        </Link>
        <nav className="flex flex-wrap gap-1 text-xs uppercase tracking-[0.12em]">
          {NAV.map((n) => {
            const active = isActive(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-md px-2.5 py-1 font-medium transition-all duration-150 ${
                  active
                    ? "bg-[var(--hud-cyan-soft)] text-[var(--hud-cyan)] shadow-[0_0_14px_rgba(79,216,238,0.18)] ring-1 ring-[var(--hud-line-2)]"
                    : "text-[var(--hud-muted)] hover:bg-[var(--hud-cyan-soft)] hover:text-[var(--hud-text)]"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.14em]"
            style={{
              borderColor: live ? "rgba(87,227,167,0.4)" : "rgba(240,184,75,0.4)",
              color: live ? "var(--hud-green)" : "var(--hud-amber)",
              background: live ? "var(--hud-green-soft)" : "var(--hud-amber-soft)",
            }}
            title={
              live
                ? "Connected to your live database — these are real records."
                : "Demo mode — sample data, nothing is saved."
            }
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background: live ? "var(--hud-green)" : "var(--hud-amber)",
                boxShadow: `0 0 8px ${live ? "var(--hud-green)" : "var(--hud-amber)"}`,
              }}
            />
            {live ? "Live" : "Demo"}
          </span>
          <RadiusPullButton />
          <OutreachButton />
        </div>
      </div>
    </header>
  );
}
