import "server-only";
import { Prisma, type LearningObservationStatus, type TransactionOutcomeStatus } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";
import { validateOutcomeReason, type OutcomeReasonCode } from "@/lib/outcome-reasons";

async function audit(tx: Prisma.TransactionClient, transactionId: string, type: string, actor: string, summary: string, details?: Prisma.InputJsonValue) {
  const latest = await tx.transactionAuditEvent.findFirst({ where: { transactionId }, orderBy: { sequence: "desc" }, select: { sequence: true } });
  return tx.transactionAuditEvent.create({ data: { transactionId, sequence: (latest?.sequence ?? 0) + 1, type, actor, summary, details } });
}

export async function recordTransactionOutcome(input: { transactionId: string; status: TransactionOutcomeStatus; actor: string; sellerProceeds?: number; assignmentFee?: number; transactionCosts?: number; cycleDays?: number; reasonCode: OutcomeReasonCode; reasonExplanation?: string; cancellationReason?: string; evidence: Prisma.InputJsonValue;decisionSnapshot:Prisma.InputJsonValue;predictedProbabilityBps?:number;projectionId?:string;priorityScoreId?:string;correctionReason?:string }) {
  if (input.status === "OPEN") throw new Error("Only final outcomes may be recorded here.");
  if ([input.sellerProceeds, input.assignmentFee, input.transactionCosts, input.cycleDays].some((value) => value !== undefined && value < 0)) throw new Error("Outcome amounts and cycle time cannot be negative.");
  if(input.predictedProbabilityBps!==undefined&&(!Number.isInteger(input.predictedProbabilityBps)||input.predictedProbabilityBps<0||input.predictedProbabilityBps>10_000))throw new Error("Predicted probability must be integer basis points from 0 to 10,000.");
  const reason = validateOutcomeReason({ status: input.status, reasonCode: input.reasonCode, explanation: input.reasonExplanation });
  if (!reason.valid) throw new Error(reason.blockers.join(" "));
  return getPrisma().$transaction(async (tx) => {
    const transaction = await tx.dealTransaction.findUnique({ where: { id: input.transactionId } });
    if (!transaction) throw new Error("Transaction not found.");
    const latest=await tx.transactionOutcome.findFirst({where:{transactionId:input.transactionId},orderBy:{version:"desc"}});if(latest&&(!input.correctionReason||input.correctionReason.trim().length<10))throw new Error("A meaningful correction reason is required for another outcome version.");
    const outcome = await tx.transactionOutcome.create({ data: { transactionId: input.transactionId,version:(latest?.version??0)+1,correctsId:latest?.id,correctionReason:input.correctionReason?.trim(), status: input.status, sellerProceeds: input.sellerProceeds, assignmentFee: input.assignmentFee, transactionCosts: input.transactionCosts, cycleDays: input.cycleDays, cancellationReason: input.cancellationReason?.trim(), reasonCode: input.reasonCode, reasonExplanation: input.reasonExplanation?.trim(), evidence: input.evidence,decisionSnapshot:input.decisionSnapshot,predictedProbabilityBps:input.predictedProbabilityBps,projectionId:input.projectionId,priorityScoreId:input.priorityScoreId, finalizedAt: new Date() } });
    await audit(tx, input.transactionId, "transaction.outcome.finalized", input.actor, `Recorded final transaction outcome ${input.status}.`, { outcomeId: outcome.id });
    return outcome;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function createWeightChangeProposal(input:{minimumSampleSize:number;proposedWeights:Prisma.InputJsonValue;rationale:string;sourceOutcomeIds:string[];actor:string}){if(!Number.isInteger(input.minimumSampleSize)||input.minimumSampleSize<30)throw new Error("At least 30 outcomes are required for a weight proposal.");if(input.sourceOutcomeIds.length<input.minimumSampleSize)throw new Error("The statistically meaningful sample threshold is not met.");if(input.rationale.trim().length<20)throw new Error("A detailed proposal rationale is required.");return getPrisma().$transaction(async tx=>{const actual=await tx.transactionOutcome.count({where:{id:{in:input.sourceOutcomeIds},status:{not:"OPEN"},predictedProbabilityBps:{not:null},projectionId:{not:null},priorityScoreId:{not:null}}});if(actual<input.minimumSampleSize)throw new Error("Verified finalized paired outcome sample is insufficient.");const latest=await tx.weightChangeProposal.findFirst({orderBy:{version:"desc"}});return tx.weightChangeProposal.create({data:{version:(latest?.version??0)+1,minimumSampleSize:input.minimumSampleSize,actualSampleSize:actual,proposedWeights:input.proposedWeights,rationale:input.rationale.trim(),sourceOutcomeIds:input.sourceOutcomeIds,createdBy:input.actor,status:"DRAFT"}});},{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});}

export async function reviewWeightChangeProposal(input:{proposalId:string;decision:"OWNER_APPROVED"|"REJECTED";actor:string;reason:string}){if(input.reason.trim().length<10)throw new Error("A meaningful owner review reason is required.");return getPrisma().weightChangeProposal.update({where:{id:input.proposalId,status:"DRAFT"},data:{status:input.decision,reviewedBy:input.actor,reviewedAt:new Date(),reviewReason:input.reason.trim()}});}

export async function recordLearningObservation(input: { outcomeId: string; metric: string; observedValue?: number; hypothesis: string; evidence?: Prisma.InputJsonValue }) {
  if (!input.metric.trim() || !input.hypothesis.trim()) throw new Error("Metric and hypothesis are required.");
  return getPrisma().learningObservation.create({ data: { outcomeId: input.outcomeId, metric: input.metric.trim(), observedValue: input.observedValue, hypothesis: input.hypothesis.trim(), evidence: input.evidence, appliedAutomatically: false } });
}

export async function reviewLearningObservation(input: { observationId: string; status: Exclude<LearningObservationStatus, "OBSERVED">; owner: string }) {
  if (!input.owner.trim()) throw new Error("Owner identity is required.");
  return getPrisma().learningObservation.update({ where: { id: input.observationId }, data: { status: input.status, ownerReviewedAt: new Date(), ownerReviewedBy: input.owner.trim(), appliedAutomatically: false } });
}

export async function readOutcomeLearningSummary() {
  const db = getPrisma();
  const [outcomes, observations] = await Promise.all([
    db.transactionOutcome.groupBy({ by: ["status"], _count: true, _sum: { assignmentFee: true, transactionCosts: true } }),
    db.learningObservation.findMany({ where: { status: { in: ["OBSERVED", "REVIEWED", "APPROVED_FOR_MANUAL_CHANGE"] } }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  return { outcomes, observations, policyChangesApplied: 0 };
}
