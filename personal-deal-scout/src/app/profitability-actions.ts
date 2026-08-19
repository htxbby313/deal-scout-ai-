"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { parseMoneyToCents } from "@/lib/financial-truth";
import { createFinancialProjectionRecord, createSettlementReviewRecord } from "@/lib/profitability-service";

export type ProfitabilityActionState = { status: "idle" | "success" | "error"; message: string };
const value = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const money = (data: FormData, key: string, required = false) => { const raw = value(data, key); if (!raw && !required) return BigInt(0); return parseMoneyToCents(raw); };
const date = (data: FormData, key: string) => { const parsed = new Date(value(data, key)); if (Number.isNaN(parsed.getTime())) throw new Error(`${key} requires a valid date.`); return parsed; };

export async function createProjectionAction(_state: ProfitabilityActionState, data: FormData): Promise<ProfitabilityActionState> {
  await requireOwner();
  try {
    const rawEvidence = JSON.parse(value(data, "costEvidence")) as Array<{ category: string; amount: string; evidenceStatus: "ESTIMATE" | "INVOICE" | "TITLE_FIGURE" | "COMMITMENT"; sourceUrl: string; observedAt: string; expiresAt?: string; artifactHash?: string }>;
    if (!Array.isArray(rawEvidence)) throw new Error("costEvidence requires a JSON array.");
    const costEvidence = rawEvidence.map((item) => ({
      category: String(item.category), amountCents: parseMoneyToCents(String(item.amount)), evidenceStatus: item.evidenceStatus,
      sourceUrl: String(item.sourceUrl), observedAt: new Date(item.observedAt),
      expiresAt: item.expiresAt ? new Date(item.expiresAt) : undefined, artifactHash: item.artifactHash ? String(item.artifactHash) : undefined,
    }));
    if (costEvidence.some((item) => Number.isNaN(item.observedAt.getTime()) || (item.expiresAt && Number.isNaN(item.expiresAt.getTime())))) throw new Error("Every cost evidence record requires valid observation and expiry dates.");
    await createFinancialProjectionRecord({ transactionId: value(data, "transactionId"), actor: "owner", costEvidence, evidenceNotes: value(data, "evidenceNotes"), correctionReason: value(data, "correctionReason") || undefined, projection: {
      sellerAskingPriceCents: money(data, "sellerAskingPrice"), sellerMinimumNetCents: money(data, "sellerMinimumNet"), sellerContractPriceCents: money(data, "sellerContractPrice", true),
      buyerPriceLowCents: money(data, "buyerPriceLow", true), buyerPriceBaseCents: money(data, "buyerPriceBase", true), buyerPriceHighCents: money(data, "buyerPriceHigh", true), buyerPriceStatus: value(data, "buyerPriceStatus") as "DOCUMENTED" | "COMMITTED", buyerPriceSourceUrl: value(data, "buyerPriceSourceUrl"), buyerPriceObservedAt: date(data, "buyerPriceObservedAt"), buyerPriceExpiresAt: date(data, "buyerPriceExpiresAt"),
      transactionCostsCents: money(data, "transactionCosts"), doubleClosingCostsCents: money(data, "doubleClosingCosts"), titleExpensesCents: money(data, "titleExpenses"), closingExpensesCents: money(data, "closingExpenses"), transactionalFundingCents: money(data, "transactionalFunding"), financingCostsCents: money(data, "financingCosts"), taxesCents: money(data, "taxes"), liensAndPayoffsCents: money(data, "liensAndPayoffs"), concessionsCents: money(data, "concessions"), inspectionExpensesCents: money(data, "inspectionExpenses"), legalExpensesCents: money(data, "legalExpenses"), dataMarketingCostsCents: money(data, "dataMarketingCosts"), insuranceExpensesCents: money(data, "insuranceExpenses"), otherExpensesCents: money(data, "otherExpenses"), riskReserveCents: money(data, "riskReserve"), contingencyReserveCents: money(data, "contingencyReserve"), earnestMoneyDepositedCents: money(data, "earnestMoneyDeposited"), earnestMoneyAtRiskCents: money(data, "earnestMoneyAtRisk"),
      probabilityLowBps: Number(value(data, "probabilityLowBps")), probabilityBaseBps: Number(value(data, "probabilityBaseBps")), probabilityHighBps: Number(value(data, "probabilityHighBps")), targetFeeLowCents: money(data, "minimumRequiredProfit", true), targetFeeHighCents: money(data, "targetProfitHigh", true),
    } });
    revalidatePath("/profitability"); revalidatePath("/transactions");
    return { status: "success", message: "Versioned financial scenario recorded from documented pricing." };
  } catch (error) { return { status: "error", message: error instanceof Error ? error.message : "Projection could not be recorded." }; }
}

export async function createSettlementReviewAction(_state: ProfitabilityActionState, data: FormData): Promise<ProfitabilityActionState> {
  await requireOwner();
  try {
    const rawLines=JSON.parse(value(data,"expenseLines")) as Array<{category:string;amount:string;sourceReference:string}>;const expenseLines=rawLines.map(line=>({category:String(line.category),amountCents:parseMoneyToCents(String(line.amount)),sourceReference:String(line.sourceReference)}));
    await createSettlementReviewRecord({ transactionId: value(data, "transactionId"), actor: "owner", grossAssignmentFeeCents: money(data, "grossAssignmentFee", true), actualExpensesCents: money(data, "actualExpenses", true), expenseLines, settlementDocumentUrl: value(data, "settlementDocumentUrl"), settlementDocumentHash: value(data, "settlementDocumentHash"), reviewedAt: date(data, "reviewedAt"), correctionReason: value(data, "correctionReason") || undefined });
    revalidatePath("/profitability"); revalidatePath("/transactions");
    return { status: "success", message: "Settlement-backed realized profit recorded." };
  } catch (error) { return { status: "error", message: error instanceof Error ? error.message : "Settlement result could not be recorded." }; }
}
