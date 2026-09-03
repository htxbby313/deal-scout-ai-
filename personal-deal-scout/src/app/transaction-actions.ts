"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import {
  advanceTransaction,
  createControlledTransaction,
  decideTransactionApproval,
  executeTransactionDocument,
  recordTransactionLegalReview,
  registerTransactionDocument,
  requestTransactionApproval,
  setOwnerControl,
} from "@/lib/transaction-control";
import type { DealTransactionStatus, TransactionApprovalType } from "@prisma/client";
import { enqueuePropertyResearch, runQueuedPropertyResearch } from "@/lib/property-research";
import { enqueueDeveloperResearch, runQueuedDeveloperResearch } from "@/lib/developer-research";
import { after } from "next/server";
import { registerProfessionalDiligenceArtifact, runDiligenceReview } from "@/lib/diligence-service";
import { enqueueAgentOperations } from "@/lib/agent-queue";

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
      await enqueueAgentOperations("EVENT");
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

export async function recordLegalReviewAction(
  transactionId: string,
  kind: "COUNSEL" | "COMPLIANCE",
  _state: TransactionActionState,
  data: FormData,
): Promise<TransactionActionState> {
  await requireOwner();
  try {
    await recordTransactionLegalReview({
      transactionId,
      kind,
      actor: "owner",
      reason: value(data, "reason"),
    });
    revalidatePath("/transactions");
    revalidatePath("/deals");
    revalidatePath("/disposition");
    return {
      status: "success",
      message:
        kind === "COUNSEL"
          ? "Counsel approval recorded."
          : "Compliance verification recorded.",
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Legal review could not be recorded.",
    };
  }
}

export async function requestApprovalAction(
  transactionId: string,
  _state: TransactionActionState,
  data: FormData,
): Promise<TransactionActionState> {
  await requireOwner();
  try {
    await requestTransactionApproval({
      transactionId,
      type: value(data, "type") as TransactionApprovalType,
      actor: "owner",
      reason: value(data, "reason") || undefined,
    });
    revalidatePath("/transactions");
    return { status: "success", message: "Approval requested." };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Approval could not be requested.",
    };
  }
}

export async function decideApprovalAction(
  approvalId: string,
  decision: "APPROVED" | "REJECTED",
  _state: TransactionActionState,
  data: FormData,
): Promise<TransactionActionState> {
  await requireOwner();
  try {
    await decideTransactionApproval({
      approvalId,
      decision,
      actor: "owner",
      reason: value(data, "reason"),
    });
    revalidatePath("/transactions");
    revalidatePath("/deals");
    revalidatePath("/disposition");
    return { status: "success", message: `Approval ${decision.toLowerCase()}.` };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Approval could not be decided.",
    };
  }
}

export async function executeDocumentAction(
  documentId: string,
  _state: TransactionActionState,
  data: FormData,
): Promise<TransactionActionState> {
  await requireOwner();
  try {
    await executeTransactionDocument({
      documentId,
      actor: "owner",
      contentHash: value(data, "contentHash"),
    });
    revalidatePath("/transactions");
    revalidatePath("/deals");
    return { status: "success", message: "Document marked executed." };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Document could not be executed.",
    };
  }
}

export async function advanceTransactionAction(
  transactionId: string,
  _state: TransactionActionState,
  data: FormData,
): Promise<TransactionActionState> {
  await requireOwner();
  try {
    const result = await advanceTransaction({
      transactionId,
      nextStatus: value(data, "nextStatus") as DealTransactionStatus,
      actor: "owner",
    });
    revalidatePath("/transactions");
    revalidatePath("/deals");
    revalidatePath("/pipeline");
    revalidatePath("/disposition");
    if (!result.advanced)
      return {
        status: "error",
        message: `Blocked: ${result.reasons.join(" ")}`,
      };
    return {
      status: "success",
      message: `Transaction advanced to ${value(data, "nextStatus").replaceAll("_", " ")}.`,
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Transaction could not advance.",
    };
  }
}

export async function registerProfessionalDiligenceAction(transactionId: string, _state: TransactionActionState, data: FormData): Promise<TransactionActionState> {
  await requireOwner();
  try {
    await registerProfessionalDiligenceArtifact({ transactionId, category: value(data, "category"), artifactHash: value(data, "artifactHash"), sourceUrl: value(data, "sourceUrl"), professionalName: value(data, "professionalName"), professionalRole: value(data, "professionalRole"), verifiedAt: new Date(value(data, "verifiedAt")), expiresAt: value(data, "expiresAt") ? new Date(value(data, "expiresAt")) : undefined, notes: value(data, "notes") || undefined });
    await runDiligenceReview(transactionId, "ENHANCED", "owner");
    revalidatePath("/transactions");
    return { status: "success", message: "Professional artifact registered and enhanced diligence rechecked." };
  } catch (error) { return { status: "error", message: error instanceof Error ? error.message : "Professional artifact could not be registered." }; }
}
