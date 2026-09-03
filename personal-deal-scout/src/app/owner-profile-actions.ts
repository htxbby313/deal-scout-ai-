"use server";

import { revalidatePath } from "next/cache";

import { requireOwner } from "@/lib/auth";
import { saveOwnerProfile } from "@/lib/owner-profile-store";

const text = (data: FormData, key: string) => String(data.get(key) ?? "").trim();

export async function saveOwnerProfileAction(formData: FormData) {
  await requireOwner();
  await saveOwnerProfile({
    displayName: text(formData, "displayName"),
    companyName: text(formData, "companyName"),
    phone: text(formData, "phone"),
    email: text(formData, "email"),
    markets: text(formData, "markets"),
  });
  revalidatePath("/settings");
  revalidatePath("/deals");
}
