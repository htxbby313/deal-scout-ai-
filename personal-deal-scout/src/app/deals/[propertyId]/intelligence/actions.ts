"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { refreshPropertyIntelligence } from "@/lib/property-intelligence";

export async function refreshPropertyIntelligenceAction(propertyId: string) {
  await requireOwner();
  await refreshPropertyIntelligence(propertyId);
  const path = `/deals/${propertyId}/intelligence`;
  revalidatePath(path);
  redirect(`${path}?refreshed=1`);
}
