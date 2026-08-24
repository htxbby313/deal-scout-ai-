import "server-only";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";

export const comparableSaleInput = z.object({
  propertyId: z.string().min(1),
  address: z.string().min(3),
  distanceMiles: z.number().min(0).max(100),
  soldDate: z.coerce.date(),
  soldPriceCents: z.bigint().positive(),
  propertyType: z.string().trim().optional(),
  bedrooms: z.number().nonnegative().optional(),
  bathrooms: z.number().nonnegative().optional(),
  squareFeet: z.number().int().positive().optional(),
  lotSquareFeet: z.number().int().positive().optional(),
  yearBuilt: z.number().int().min(1700).max(2200).optional(),
  condition: z.string().trim().optional(),
  sourceUrl: z
    .string()
    .url()
    .refine((value) => value.startsWith("https://"), "Source must use HTTPS."),
  observedAt: z.coerce.date(),
  confidence: z.number().int().min(1).max(100),
  createdBy: z.string().min(1),
});

export async function recordComparableSale(
  input: z.infer<typeof comparableSaleInput>,
) {
  const parsed = comparableSaleInput.parse(input);
  const now = new Date();
  if (parsed.soldDate > now || parsed.observedAt > now)
    throw new Error("Comparable evidence dates cannot be in the future.");
  const db = getPrisma();
  return db.$transaction(async (tx) => {
    const created = await tx.comparableSale.create({ data: parsed });
    await tx.auditLog.create({
      data: {
        type: "deal.comp_recorded",
        summary: `Recorded sourced comparable sale for ${parsed.address}.`,
        details: {
          comparableSaleId: created.id,
          propertyId: parsed.propertyId,
          sourceUrl: parsed.sourceUrl,
          observedAt: parsed.observedAt.toISOString(),
        },
      },
    });
    return created;
  });
}
