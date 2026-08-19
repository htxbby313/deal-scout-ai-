"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { createControlledTransaction, registerTransactionDocument, setOwnerControl } from "@/lib/transaction-control";
import { enqueuePropertyResearch, runQueuedPropertyResearch } from "@/lib/property-research";
import { enqueueDeveloperResearch, runQueuedDeveloperResearch } from "@/lib/developer-research";
import { after } from "next/server";

export type TransactionActionState = { status: "idle" | "success" | "error"; message: string };
const value = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const money = (data: FormData, key: string) => value(data, key) ? Number(value(data, key)) : undefined;

export async function createTransactionAction(_state: TransactionActionState, data: FormData): Promise<TransactionActionState> {
  await requireOwner();
  try {
    const propertyId = value(data, "propertyId");
    const developerId = value(data, "developerId") || undefined;
    await createControlledTransaction({ propertyId, developerId, targetSellerPrice: money(data, "targetSellerPrice"), targetBuyerPrice: money(data, "targetBuyerPrice"), targetAssignmentFee: money(data, "targetAssignmentFee"), actor: "owner" });
    const propertyRun = await enqueuePropertyResearch(propertyId);
    const developerRun = developerId ? await enqueueDeveloperResearch(developerId) : null;
    after(async () => {
      await Promise.all([runQueuedPropertyResearch(propertyRun.id), developerRun ? runQueuedDeveloperResearch(developerRun.id) : Promise.resolve()]);
    });
    revalidatePath("/transactions");
    return { status: "success", message: "Transaction created on owner hold." };
  } catch (error) { return { status: "error", message: error instanceof Error ? error.message : "Transaction could not be created." }; }
}

export async function setTransactionControlAction(transactionId: string, controlStatus: "ACTIVE" | "ON_HOLD" | "STOPPED", _state: TransactionActionState, data: FormData): Promise<TransactionActionState> {
  await requireOwner();
  try {
    await setOwnerControl({ transactionId, controlStatus, actor: "owner", reason: value(data, "reason") });
    revalidatePath("/transactions");
    return { status: "success", message: controlStatus === "STOPPED" ? "Transaction stopped permanently." : `Transaction set to ${controlStatus.toLowerCase().replace("_", " ")}.` };
  } catch (error) { return { status: "error", message: error instanceof Error ? error.message : "Control could not be changed." }; }
}

export async function registerTransactionDocumentAction(transactionId: string, _state: TransactionActionState, data: FormData): Promise<TransactionActionState> {
  await requireOwner();
  try {
    await registerTransactionDocument({ transactionId, type: value(data, "type"), title: value(data, "title"), sourceUrl: value(data, "sourceUrl"), actor: "owner" });
    revalidatePath("/transactions");
    return { status: "success", message: "Document registered with an audit event." };
  } catch (error) { return { status: "error", message: error instanceof Error ? error.message : "Document could not be registered." }; }
}
