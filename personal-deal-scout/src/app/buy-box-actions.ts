"use server";

import { revalidatePath } from "next/cache";

import { requireOwner } from "@/lib/auth";
import { applyBuyBox, criteriaFromForm, saveBuyBox } from "@/lib/buy-box-service";

const text = (data: FormData, key: string) => String(data.get(key) ?? "").trim();

export async function saveBuyBoxAction(formData: FormData) {
  await requireOwner();
  const criteria = criteriaFromForm({
    name: text(formData, "name"),
    prompt: text(formData, "prompt"),
    states: text(formData, "states"),
    cities: text(formData, "cities"),
    zipCodes: text(formData, "zipCodes"),
    propertyTypes: text(formData, "propertyTypes"),
    minPrice: text(formData, "minPrice"),
    maxPrice: text(formData, "maxPrice"),
    minSpread: text(formData, "minSpread"),
  });
  const box = await saveBuyBox(criteria);
  await applyBuyBox(box.id);
  revalidatePath("/properties");
  revalidatePath("/owner-queue");
  revalidatePath("/pipeline");
}

export async function scanBuyBoxAction(formData: FormData) {
  await requireOwner();
  const id = text(formData, "buyBoxId");
  if (!id) throw new Error("A Buy Box is required.");
  await applyBuyBox(id);
  revalidatePath("/properties");
  revalidatePath("/owner-queue");
  revalidatePath("/pipeline");
}
