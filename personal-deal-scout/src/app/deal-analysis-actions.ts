"use server";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { saveDealAssumptions } from "@/lib/deal-assumptions";
import { REHAB_CATEGORIES, type DealStrategy, type RehabMode } from "@/lib/deal-analysis";
import { parseMoneyToCents } from "@/lib/financial-truth";

const text = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const optionalMoneyCents = (data: FormData, key: string) => {
  const value = text(data, key);
  return value ? parseMoneyToCents(value) : undefined;
};

export async function saveDealAssumptionsAction(formData: FormData) {
  await requireOwner();
  const propertyId = text(formData, "propertyId");
  if (!propertyId) throw new Error("A property is required to save deal assumptions.");
  const rehabMode = text(formData, "rehabMode") as RehabMode;
  const customCents =
    rehabMode === "CUSTOM"
      ? Object.fromEntries(
          REHAB_CATEGORIES.map((category) => [
            category,
            optionalMoneyCents(formData, `custom_${category}`) ?? BigInt(0),
          ]),
        )
      : undefined;
  const { transactionId, assumptions } = await saveDealAssumptions({
    propertyId,
    strategy: text(formData, "strategy") as DealStrategy,
    rehabMode,
    squareFeet: text(formData, "squareFeet") ? Number(text(formData, "squareFeet")) : undefined,
    ratePerSquareFootCents: optionalMoneyCents(formData, "ratePerSquareFootCents"),
    customCents,
    acquisitionCents: optionalMoneyCents(formData, "acquisitionCents"),
    transactionCostsCents: optionalMoneyCents(formData, "transactionCostsCents"),
    financingCostsCents: optionalMoneyCents(formData, "financingCostsCents"),
    holdingCostsCents: optionalMoneyCents(formData, "holdingCostsCents"),
    monthlyRentCents: optionalMoneyCents(formData, "monthlyRentCents"),
    monthlyExpensesCents: optionalMoneyCents(formData, "monthlyExpensesCents"),
    updatedBy: "owner",
  });
  revalidatePath(`/deals/${propertyId}`);
  revalidatePath(`/deals/${propertyId}/package`);
  return { transactionId, assumptions };
}
