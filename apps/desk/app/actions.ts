"use server";
// Server actions — the write path for the UI. All mutations go through the
// data abstraction (fixtures or Supabase). revalidatePath refreshes the
// affected routes after each write.
import { revalidatePath } from "next/cache";
import type { BuyerInsert, DealStage } from "@parcel/types";
import {
  advanceContract,
  createBuyer,
  deleteBuyer,
  setDealStage,
  updateBuyer,
} from "@/lib/data";

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
