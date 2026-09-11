"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { createContractPacket } from "@/lib/contract-packet";
import { openTitle, updateTitleOpening } from "@/lib/title-company";
import { getPrisma } from "@/lib/prisma";

export type WorkflowActionState = { status: "idle" | "success" | "error"; message: string };
const text = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const money = (data: FormData, key: string, required = true) => { const value = Number(text(data, key)); if ((!Number.isFinite(value) || value < 0) && required) throw new Error(`${key} must be a valid amount.`); return BigInt(Math.round((Number.isFinite(value) ? value : 0) * 100)); };
const date = (data: FormData, key: string, required = true) => { const raw = text(data, key); if (!raw && !required) return undefined; const value = new Date(`${raw}T12:00:00`); if (Number.isNaN(value.getTime())) throw new Error(`${key} must be a valid date.`); return value; };

export async function generateContractPacketAction(_state: WorkflowActionState, data: FormData): Promise<WorkflowActionState> {
  await requireOwner();
  try {
    const structure = text(data, "structure") as "ASSIGNMENT" | "DOUBLE_CLOSE" | "DIRECT_PURCHASE";
    await createContractPacket({ transactionId: text(data, "transactionId"), structure, effectiveDate: date(data, "effectiveDate", false), closingDate: date(data, "closingDate")!, feasibilityDays: Number(text(data, "feasibilityDays")), accessNoticeHours: Number(text(data, "accessNoticeHours")), earnestMoneyCents: money(data, "earnestMoney"), feasibilityFeeCents: money(data, "feasibilityFee"), purchasePriceCents: money(data, "purchasePrice"), assignmentFeeCents: structure === "ASSIGNMENT" ? money(data, "assignmentFee") : undefined, assignmentDepositCents: structure === "ASSIGNMENT" ? money(data, "assignmentDeposit") : undefined, assigneeDiligenceDeadline: structure === "ASSIGNMENT" ? date(data, "assigneeDiligenceDeadline", false) : undefined, proofOfFundsDueAt: structure === "ASSIGNMENT" ? date(data, "proofOfFundsDueAt", false) : undefined, sellerLegalName: text(data, "sellerLegalName"), buyerLegalName: text(data, "buyerLegalName"), assigneeLegalName: text(data, "assigneeLegalName") || undefined, legalDescription: text(data, "legalDescription"), propertyType: text(data, "propertyType"), costAllocation: text(data, "costAllocation"), sellerNoticeInformation: text(data, "sellerNoticeInformation"), buyerNoticeInformation: text(data, "buyerNoticeInformation"), brokerDisclosure: text(data, "brokerDisclosure"), assignmentContingency: text(data, "assignmentContingency") || undefined, titleCompanyId: text(data, "titleCompanyId") || undefined, generatedBy: "owner" });
    revalidatePath("/contracts"); revalidatePath(`/deals/${text(data, "propertyId")}`); revalidatePath("/transactions");
    return { status: "success", message: "Texas contract packet saved as a review draft." };
  } catch (error) { return { status: "error", message: error instanceof Error ? error.message : "Packet generation failed." }; }
}

export async function openTitleAction(_state: WorkflowActionState, data: FormData): Promise<WorkflowActionState> {
  await requireOwner();
  try { await openTitle({ transactionId: text(data, "transactionId"), titleCompanyId: text(data, "titleCompanyId"), targetCloseAt: date(data, "targetCloseAt", false), earnestMoneyDueAt: date(data, "earnestMoneyDueAt", false), notes: text(data, "notes") || undefined, actor: "owner" }); revalidatePath("/title-companies"); revalidatePath(`/deals/${text(data, "propertyId")}`); return { status: "success", message: "Title opening prepared and attached to the deal." }; }
  catch (error) { return { status: "error", message: error instanceof Error ? error.message : "Could not prepare title opening." }; }
}

export async function updateTitleOpeningAction(data: FormData) { await requireOwner(); await updateTitleOpening({ id: text(data, "id"), status: text(data, "status") as never, fileNumber: text(data, "fileNumber"), escrowOfficer: text(data, "escrowOfficer"), notes: text(data, "notes"), actor: "owner" }); revalidatePath("/title-companies"); }

export async function updateTitleCompanyAction(data: FormData) {
  await requireOwner(); const id = text(data, "id"); const truth = (key: string) => text(data, key) === "YES" ? true : text(data, key) === "NO" ? false : null; const status = text(data, "status") as never;
  await getPrisma().titleCompany.update({ where: { id }, data: { status, priority: text(data, "priority") as never, counties: text(data, "counties").split(",").map(v=>v.trim()).filter(Boolean), serviceAreas: text(data, "serviceAreas").split(",").map(v=>v.trim()).filter(Boolean), assignmentAcceptance: truth("assignmentAcceptance"), doubleCloseCapability: truth("doubleCloseCapability"), transactionalFundingCoordination: truth("transactionalFundingCoordination"), eClosing: truth("eClosing"), earnestMoneyInstructions: text(data, "earnestMoneyInstructions") || null, typicalTurnaround: text(data, "typicalTurnaround") || null, requiredDocuments: text(data, "requiredDocuments").split("\n").map(v=>v.trim()).filter(Boolean), notes: text(data, "notes") || null, verifiedAt: status === "VERIFIED" || status === "USED_SUCCESSFULLY" || status === "PREFERRED" ? new Date() : null, verifiedBy: status === "VERIFIED" || status === "USED_SUCCESSFULLY" || status === "PREFERRED" ? "owner" : null } });
  revalidatePath("/title-companies");
}
