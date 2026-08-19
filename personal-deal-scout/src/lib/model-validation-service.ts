import "server-only";
import { getPrisma } from "@/lib/prisma";
import { buildModelValidationReport } from "@/lib/model-validation";

export async function readModelValidationReport(minimumSampleSize = 30) {
  const outcomes = await getPrisma().transactionOutcome.findMany({
    where: { finalizedAt: { not: null } },
    include: { transaction: { select: { targetAssignmentFee: true } } },
    orderBy: { finalizedAt: "asc" },
  });
  return buildModelValidationReport(outcomes.map((outcome) => ({ status: outcome.status, assignmentFee: outcome.assignmentFee, predictedAssignmentFee: outcome.transaction.targetAssignmentFee })), minimumSampleSize);
}
