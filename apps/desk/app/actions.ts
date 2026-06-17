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
  seedClosingTasks,
  setClosingTaskStatus,
  setDealStage,
  updateBuyer,
  updateDealClosing,
} from "@/lib/data";
import {
  inferBuyersFromCashSales,
  inferBuyersFromOwnership,
  type CashSaleRecord,
  type OwnerParcel,
} from "@/lib/buyers-import";

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

// ── closing coordinator ────────────────────────────────────────────────────
export async function seedClosingAction(dealId: string) {
  await seedClosingTasks(dealId);
  revalidatePath(`/deals/${dealId}`);
}

export async function toggleClosingTaskAction(
  taskId: string,
  dealId: string,
  done: boolean,
) {
  await setClosingTaskStatus(taskId, done ? "done" : "pending");
  revalidatePath(`/deals/${dealId}`);
}

export async function updateClosingInfoAction(dealId: string, form: FormData) {
  await updateDealClosing(dealId, {
    title_company: (form.get("title_company") as string) || null,
    closing_date: (form.get("closing_date") as string) || null,
  });
  revalidatePath(`/deals/${dealId}`);
}

// Import cash-buyer buy-boxes from pasted county cash-closing records (JSON
// array). Infers one buy-box per buyer and adds them via the data layer
// (fixtures or Supabase). Returns how many buyers were created.
export async function importBuyersAction(
  recordsJson: string,
): Promise<{ inserted: number; error?: string }> {
  let arr: unknown[];
  try {
    const parsed = JSON.parse(recordsJson);
    if (!Array.isArray(parsed)) return { inserted: 0, error: "Expected a JSON array of records." };
    arr = parsed;
  } catch {
    return { inserted: 0, error: "Invalid JSON." };
  }
  // Auto-detect: ownership records (owner_name → multi-property investors) vs
  // cash-sale records (buyer_name → recent cash purchasers).
  const first = arr[0] as Record<string, unknown> | undefined;
  const buyers =
    first && "owner_name" in first
      ? inferBuyersFromOwnership(arr as OwnerParcel[])
      : inferBuyersFromCashSales(arr as CashSaleRecord[]);
  for (const b of buyers) await createBuyer(b);
  revalidatePath("/buyers");
  return { inserted: buyers.length };
}
