import "server-only";
import type { EngagementChannel } from "@prisma/client";
import { evaluateContactProcedure, permittedLocalTime } from "@/lib/communication-procedure-policy";
import { getPrisma } from "@/lib/prisma";

const secureUrl = (raw?: string) => { if (!raw) return undefined; const value = new URL(raw); if (value.protocol !== "https:") throw new Error("Evidence URL must use HTTPS."); return value.toString(); };

export async function createDraftCommunicationProcedure(input: { jurisdictionState: string; channel: EngagementChannel; procedureText: string; requiredDisclosure?: string; permittedStartLocal?: string; permittedEndLocal?: string; createdBy: string }) {
  const state = input.jurisdictionState.toUpperCase();
  if (!/^[A-Z]{2}$/.test(state) || input.procedureText.trim().length < 20) throw new Error("Jurisdiction and a meaningful written procedure are required.");
  const db = getPrisma();
  const latest = await db.communicationPolicyProcedure.findFirst({ where: { jurisdictionState: state, channel: input.channel }, orderBy: { version: "desc" } });
  return db.communicationPolicyProcedure.create({ data: { jurisdictionState: state, channel: input.channel, version: (latest?.version ?? 0) + 1, status: "DRAFT", procedureText: input.procedureText.trim(), requiredDisclosure: input.requiredDisclosure?.trim(), permittedStartLocal: input.permittedStartLocal, permittedEndLocal: input.permittedEndLocal, createdBy: input.createdBy } });
}

export async function acknowledgeCommunicationTraining(input: { procedureId: string; actor: string; evidenceHash?: string }) {
  if (!input.actor.trim() || (input.evidenceHash && !/^[a-f0-9]{64}$/i.test(input.evidenceHash))) throw new Error("Actor and optional SHA-256 evidence hash must be valid.");
  return getPrisma().communicationTrainingAcknowledgment.create({ data: { procedureId: input.procedureId, actor: input.actor.trim(), evidenceHash: input.evidenceHash?.toLowerCase() } });
}

export async function recordCommunicationListScrub(input: { procedureId: string; source: string; sourceUrl?: string; artifactHash: string; recordCount: number; scrubbedAt: Date; expiresAt: Date; reviewedBy: string }) {
  if (!/^[a-f0-9]{64}$/i.test(input.artifactHash) || input.recordCount < 0 || input.expiresAt <= input.scrubbedAt || !input.reviewedBy.trim()) throw new Error("Reviewed, hashed, current list-scrub evidence is required.");
  return getPrisma().communicationListScrub.create({ data: { ...input, sourceUrl: secureUrl(input.sourceUrl), artifactHash: input.artifactHash.toLowerCase(), reviewedBy: input.reviewedBy.trim() } });
}

export async function evaluateDraftContactProcedure(input: { procedureId: string; actor: string; localTime: string }) {
  const db = getPrisma();
  const procedure = await db.communicationPolicyProcedure.findUnique({ where: { id: input.procedureId }, include: { acknowledgments: { where: { actor: input.actor } }, listScrubs: { orderBy: { scrubbedAt: "desc" }, take: 1 } } });
  if (!procedure) throw new Error("Communication procedure not found.");
  const scrub = procedure.listScrubs[0];
  return evaluateContactProcedure({ procedureStatus: procedure.status, requiredDisclosure: procedure.requiredDisclosure, counselApprovedAt: procedure.counselApprovedAt, effectiveAt: procedure.effectiveAt, expiresAt: procedure.expiresAt, trainingAcknowledged: procedure.acknowledgments.length > 0, listScrubAt: scrub?.scrubbedAt, listScrubExpiresAt: scrub?.expiresAt, permittedWindow: Boolean(procedure.permittedStartLocal && procedure.permittedEndLocal && permittedLocalTime({ localTime: input.localTime, permittedStart: procedure.permittedStartLocal, permittedEnd: procedure.permittedEndLocal })) });
}
