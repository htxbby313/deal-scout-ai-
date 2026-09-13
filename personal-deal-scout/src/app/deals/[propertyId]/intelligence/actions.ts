"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { refreshPropertyIntelligence } from "@/lib/property-intelligence";

export async function refreshPropertyIntelligenceAction(propertyId: string) {
  await requireOwner();
  const path = `/deals/${propertyId}/intelligence`;
  try {
    await refreshPropertyIntelligence(propertyId);
    revalidatePath(path);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Property intelligence refresh failed.";
    redirect(`${path}?error=${encodeURIComponent(message)}`);
  }
  redirect(`${path}?refreshed=1`);
}
