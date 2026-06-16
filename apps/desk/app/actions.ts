"use server";
// Server actions — the write path for the UI. All mutations go through the
// data abstraction (fixtures or Supabase). revalidatePath refreshes the
// affected routes after each write.
import { revalidatePath } from "next/cache";
import type { BuyerInsert, DealStage } from "@parcel/types";
import {
  advanceContract,
  assignDealToBuyer,
  createBuyer,
  deleteBuyer,
  dispatchToBuyers,
  setDealStage,
  updateBuyer,
} from "@/lib/data";
import { inferBuyersFromCashSales, type CashSaleRecord } from "@/lib/buyers-import";

export async function moveDealAction(id: string, stage: DealStage) {
  await setDealStage(id, stage);
  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath(`/deals/${id}`);
}

function parseBuyerForm(form: FormData): BuyerInsert {
  const num = (k: string) => {
    const v = form.get(k);
    return v === null || v === "" ? null : Number(v);
  };
  const areas = String(form.get("areas") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    name: (form.get("name") as string) || null,
    type: (form.get("type") as string) || null,
    min_price: num("min_price"),
    max_price: num("max_price"),
    min_beds: num("min_beds"),
    areas: areas.length ? areas : null,
    max_repairs: num("max_repairs"),
    notes: (form.get("notes") as string) || null,
    email: (form.get("email") as string) || null,
    phone: (form.get("phone") as string) || null,
  };
}

export async function createBuyerAction(form: FormData) {
  await createBuyer(parseBuyerForm(form));
  revalidatePath("/buyers");
}

export async function updateBuyerAction(id: string, form: FormData) {
  await updateBuyer(id, parseBuyerForm(form));
  revalidatePath("/buyers");
}

export async function deleteBuyerAction(id: string) {
  await deleteBuyer(id);
  revalidatePath("/buyers");
}

export async function advanceContractAction(id: string) {
  await advanceContract(id);
  revalidatePath("/contracts");
  revalidatePath("/dashboard");
}

export async function assignDealAction(dealId: string, buyerId: string) {
  await assignDealToBuyer(dealId, buyerId);
  revalidatePath(`/deals/${dealId}`);
  revalidatePath("/");
  revalidatePath("/contracts");
  revalidatePath("/dashboard");
}

export async function dispatchDealAction(
  dealId: string,
  tier: "exclusive" | "blast",
) {
  const count = await dispatchToBuyers(dealId, tier);
  revalidatePath(`/deals/${dealId}`);
  return count;
}

// Import cash-buyer buy-boxes from pasted county cash-closing records (JSON
// array). Infers one buy-box per buyer and adds them via the data layer
// (fixtures or Supabase). Returns how many buyers were created.
export async function importBuyersAction(
  recordsJson: string,
): Promise<{ inserted: number; error?: string }> {
  let records: CashSaleRecord[];
  try {
    const parsed = JSON.parse(recordsJson);
    if (!Array.isArray(parsed)) return { inserted: 0, error: "Expected a JSON array of records." };
    records = parsed as CashSaleRecord[];
  } catch {
    return { inserted: 0, error: "Invalid JSON." };
  }
  const buyers = inferBuyersFromCashSales(records);
  for (const b of buyers) await createBuyer(b);
  revalidatePath("/buyers");
  return { inserted: buyers.length };
}
