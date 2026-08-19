import "server-only";
import { createHash } from "node:crypto";
import { Prisma, type ContractTemplateType } from "@prisma/client";
import { evaluateContractTemplateActivation } from "@/lib/contract-template-policy";
import { getPrisma } from "@/lib/prisma";

function httpsUrl(raw: string) { const url = new URL(raw); if (url.protocol !== "https:") throw new Error("Contract review evidence must use HTTPS."); return url.toString(); }

export async function createInactiveContractPlaceholder(input: { name: string; type: ContractTemplateType; jurisdictionState: string; actor: string }) {
  if (!input.name.trim() || !/^[A-Z]{2}$/.test(input.jurisdictionState.toUpperCase())) throw new Error("Template name and two-letter jurisdiction are required.");
  const db = getPrisma();
  const latest = await db.contractTemplateVersion.findFirst({ where: { jurisdictionState: input.jurisdictionState.toUpperCase(), type: input.type }, orderBy: { version: "desc" } });
  const placeholder = await db.contractTemplateVersion.create({ data: { name: input.name.trim(), type: input.type, jurisdictionState: input.jurisdictionState.toUpperCase(), version: (latest?.version ?? 0) + 1, status: "INACTIVE_PLACEHOLDER" } });
  await db.auditLog.create({ data: { type: "contract.template.placeholder", summary: `Created inactive ${input.type} placeholder for ${placeholder.jurisdictionState}; no legal text or execution authority exists.`, details: { templateVersionId: placeholder.id, actor: input.actor } } });
  return placeholder;
}

export async function registerUserSuppliedContractArtifact(input: { name: string; type: ContractTemplateType; jurisdictionState: string; content: Uint8Array; storageKey?: string; sourceUrl?: string; suppliedBy: string }) {
  if (!input.content.byteLength) throw new Error("A real user-supplied contract artifact is required.");
  if (!input.storageKey && !input.sourceUrl) throw new Error("A durable artifact location is required.");
  const jurisdictionState = input.jurisdictionState.toUpperCase();
  if (!/^[A-Z]{2}$/.test(jurisdictionState) || !input.suppliedBy.trim()) throw new Error("Jurisdiction and supplier identity are required.");
  const artifactHash = createHash("sha256").update(input.content).digest("hex");
  const db = getPrisma();
  return db.$transaction(async (tx) => {
    const existing = await tx.contractTemplateVersion.findFirst({ where: { jurisdictionState, type: input.type, artifactHash }, orderBy: { version: "desc" } });
    if (existing) return existing;
    const latest = await tx.contractTemplateVersion.findFirst({ where: { jurisdictionState, type: input.type }, orderBy: { version: "desc" } });
    const version = await tx.contractTemplateVersion.create({ data: { name: input.name.trim(), type: input.type, jurisdictionState, version: (latest?.version ?? 0) + 1, status: "REVIEW_PENDING", artifactHash, storageKey: input.storageKey, sourceUrl: input.sourceUrl ? httpsUrl(input.sourceUrl) : undefined, userSuppliedBy: input.suppliedBy.trim(), userSuppliedAt: new Date() } });
    await tx.auditLog.create({ data: { type: "contract.template.artifact_registered", summary: `Registered user-supplied ${input.type} artifact for review; it remains inactive.`, details: { templateVersionId: version.id, artifactHash, suppliedBy: input.suppliedBy } } });
    return version;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function readContractTemplateVersions() {
  return getPrisma().contractTemplateVersion.findMany({ orderBy: [{ jurisdictionState: "asc" }, { type: "asc" }, { version: "desc" }] });
}

export async function recordContractCounselApproval(input: { templateVersionId: string; reviewer: string; approvedAt: Date; evidenceUrl: string }) {
  if (!input.reviewer.trim() || input.approvedAt > new Date()) throw new Error("Counsel reviewer and valid approval date are required.");
  return getPrisma().contractTemplateVersion.update({ where: { id: input.templateVersionId }, data: { counselReviewer: input.reviewer.trim(), counselApprovedAt: input.approvedAt, counselApprovalEvidenceUrl: httpsUrl(input.evidenceUrl) } });
}

export async function recordContractOwnerApproval(input: { templateVersionId: string; owner: string; reason: string; approvedAt?: Date }) {
  if (!input.owner.trim() || input.reason.trim().length < 10) throw new Error("Owner identity and a meaningful approval reason are required.");
  return getPrisma().contractTemplateVersion.update({ where: { id: input.templateVersionId }, data: { ownerApprovedBy: input.owner.trim(), ownerApprovedAt: input.approvedAt ?? new Date(), ownerApprovalReason: input.reason.trim() } });
}

export async function activateContractTemplate(input: { templateVersionId: string; jurisdictionState: string; effectiveAt: Date; expiresAt: Date; actor: string }) {
  const db = getPrisma();
  return db.$transaction(async (tx) => {
    const version = await tx.contractTemplateVersion.findUnique({ where: { id: input.templateVersionId } });
    if (!version) throw new Error("Contract template version not found.");
    const candidate = { ...version, effectiveAt: input.effectiveAt, expiresAt: input.expiresAt };
    const decision = evaluateContractTemplateActivation({ ...candidate, requestedJurisdictionState: input.jurisdictionState, artifactLocated: Boolean(version.storageKey || version.sourceUrl) });
    if (!decision.allowed) return { activated: false as const, blockers: decision.blockers, version };
    await tx.contractTemplateVersion.updateMany({ where: { jurisdictionState: version.jurisdictionState, type: version.type, status: "ACTIVE" }, data: { status: "SUPERSEDED" } });
    const activated = await tx.contractTemplateVersion.update({ where: { id: version.id }, data: { status: "ACTIVE", effectiveAt: input.effectiveAt, expiresAt: input.expiresAt, activatedAt: new Date() } });
    await tx.auditLog.create({ data: { type: "contract.template.activated", summary: `Activated reviewed ${version.type} artifact for ${version.jurisdictionState}.`, details: { templateVersionId: version.id, artifactHash: version.artifactHash, actor: input.actor } as Prisma.InputJsonValue } });
    return { activated: true as const, blockers: [], version: activated };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function readActiveContractTemplate(type: ContractTemplateType, jurisdictionState: string, now = new Date()) {
  return getPrisma().contractTemplateVersion.findFirst({ where: { type, jurisdictionState: jurisdictionState.toUpperCase(), status: "ACTIVE", activatedAt: { not: null }, effectiveAt: { lte: now }, expiresAt: { gt: now } } });
}
