"use server";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { recordComparableSale } from "@/lib/comp-service";
import { parseMoneyToCents } from "@/lib/financial-truth";
import { registerZillowDiscoveryReference } from "@/lib/zillow-market-service";

const text = (data: FormData, key: string) =>
  String(data.get(key) ?? "").trim();
const optionalNumber = (data: FormData, key: string) =>
  text(data, key) ? Number(text(data, key)) : undefined;

export async function recordComparableSaleAction(formData: FormData) {
  await requireOwner();
  const propertyId = text(formData, "propertyId");
  await recordComparableSale({
    propertyId,
    address: text(formData, "address"),
    distanceMiles: Number(text(formData, "distanceMiles")),
    soldDate: new Date(text(formData, "soldDate")),
    soldPriceCents: parseMoneyToCents(text(formData, "soldPrice")),
    propertyType: text(formData, "propertyType") || undefined,
    bedrooms: optionalNumber(formData, "bedrooms"),
    bathrooms: optionalNumber(formData, "bathrooms"),
    squareFeet: optionalNumber(formData, "squareFeet"),
    lotSquareFeet: optionalNumber(formData, "lotSquareFeet"),
    yearBuilt: optionalNumber(formData, "yearBuilt"),
    condition: text(formData, "condition") || undefined,
    sourceUrl: text(formData, "sourceUrl"),
    observedAt: new Date(text(formData, "observedAt")),
    confidence: Number(text(formData, "confidence")),
    createdBy: "owner",
  });
  revalidatePath(`/deals/${propertyId}`);
}

export async function registerZillowReferenceAction(formData: FormData) {
  await requireOwner();
  const propertyId = text(formData, "propertyId");
  const result = await registerZillowDiscoveryReference({
    propertyId: propertyId || undefined,
    submittedBy: "owner",
    url: text(formData, "url"),
    observedAddress: text(formData, "observedAddress") || undefined,
    observedCity: text(formData, "observedCity") || undefined,
    observedState: text(formData, "observedState") || undefined,
    observedZipCode: text(formData, "observedZipCode") || undefined,
    observedAskingPrice: text(formData, "observedAskingPrice")
      ? Number(text(formData, "observedAskingPrice"))
      : undefined,
    observedAvailability: text(formData, "observedAvailability") || undefined,
    observationNotes: text(formData, "observationNotes") || undefined,
  });
  revalidatePath("/properties");
  if (result.reference.propertyId)
    revalidatePath(`/deals/${result.reference.propertyId}`);
}
