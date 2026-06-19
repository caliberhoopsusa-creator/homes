import type { Metadata, Viewport } from "next";
import { Chakra_Petch, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { isLive } from "@/lib/data";

// JARVIS-style HUD type system, loaded once for the whole desk.
const display = Chakra_Petch({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Parcel Desk",
  description: "Operator cockpit for the Parcel wholesale acquisition engine.",
  applicationName: "Parcel Desk",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Parcel Desk",
  },
};

export const viewport: Viewport = {
  themeColor: "#060a0f",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable}`}>
      <body className="min-h-dvh antialiased">
        {/* HUD frame: viewport corner brackets + scanline sweep. Decorative. */}
        <div className="hud-frame" aria-hidden>
          <span className="hud-corner hud-corner-tl" />
          <span className="hud-corner hud-corner-tr" />
          <span className="hud-corner hud-corner-bl" />
          <span className="hud-corner hud-corner-br" />
          <span className="hud-scan" />
        </div>
        <Header live={isLive()} />
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
