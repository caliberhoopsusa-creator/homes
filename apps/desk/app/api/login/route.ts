// Verifies the operator password and sets the auth cookie. The cookie value is
// sha256(password) — the same value middleware recomputes to authorize requests,
// so the raw password never lives in the cookie. nodejs runtime (node:crypto).
import { createHash, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const THIRTY_DAYS = 60 * 60 * 24 * 30;

export async function POST(req: Request): Promise<Response> {
  const password = process.env.DESK_PASSWORD;
  if (!password) return Response.json({ ok: true, note: "login disabled" });

  let submitted = "";
  try {
    submitted = ((await req.json()) as { password?: string }).password ?? "";
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  const a = createHash("sha256").update(submitted).digest();
  const b = createHash("sha256").update(password).digest();
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return Response.json({ ok: false, error: "Wrong password." }, { status: 401 });
  }

  const token = createHash("sha256").update(password).digest("hex");
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const res = Response.json({ ok: true });
  res.headers.append(
    "set-cookie",
    `desk_auth=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${THIRTY_DAYS}${secure}`,
  );
  return res;
}
