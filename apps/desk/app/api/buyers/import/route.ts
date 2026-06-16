// Import cash-buyer buy-boxes from public county cash-closing records.
// POST a JSON body { records: CashSaleRecord[] } (produced by a per-county ETL);
// we infer one buy-box per buyer and insert them as `buyers`. Builds the
// disposition moat (docs/RESEARCH-wholesaling.md §7). Node runtime / service-role.
import type { NextRequest } from "next/server";
import { createServiceClient, insertBuyers } from "@parcel/db";
import {
  inferBuyersFromCashSales,
  type CashSaleRecord,
} from "@/lib/buyers-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  let body: { records?: CashSaleRecord[] };
  try {
    body = (await req.json()) as { records?: CashSaleRecord[] };
  } catch {
    return Response.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const records = Array.isArray(body.records) ? body.records : [];
  if (records.length === 0) {
    return Response.json({ ok: false, error: "no records" }, { status: 400 });
  }

  const buyers = inferBuyersFromCashSales(records);

  try {
    const inserted = await insertBuyers(createServiceClient(), buyers);
    return Response.json({ ok: true, inferred: buyers.length, inserted });
  } catch {
    // DB not configured — return the inferred buy-boxes so the caller can preview.
    return Response.json(
      { ok: false, reason: "database not configured", inferred: buyers.length, buyers },
      { status: 202 },
    );
  }
}
