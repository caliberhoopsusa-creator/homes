// Operator login gate. ACTIVE only when DESK_PASSWORD is set (so local dev stays
// open and nothing breaks until you deploy). When set, every page/route requires
// the auth cookie except the login flow and the inbound/opt-in webhooks that
// external services must reach. Runs on the Edge runtime — uses Web Crypto only.
import { NextResponse, type NextRequest } from "next/server";

// Public paths (no auth): login, the SendGrid/Twilio webhooks, and the public
// seller SMS opt-in. Everything else is gated.
const PUBLIC = [
  "/login",
  "/api/login",
  "/api/inbound",
  "/api/sms/inbound",
  "/api/sms/optin",
  "/sms-optin",
  "/manifest.webmanifest",
];

async function sha256hex(s: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const password = process.env.DESK_PASSWORD;
  if (!password) return NextResponse.next(); // gate disabled (local/dev)

  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get("desk_auth")?.value;
  if (cookie && cookie === (await sha256hex(password))) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

// Run on everything except Next internals and static files.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
