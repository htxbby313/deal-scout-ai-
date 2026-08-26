import "server-only";

import { Prisma, type AgentRole } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";
import {
  AGENT_TASK_TYPES,
  evaluateAgentTask,
  evaluateSupervisedTrackRecord,
  taskActionPolicy,
  taskOwner,
  type AgentTaskType,
} from "@/lib/agent-workflow-policy";
import { researchProperty } from "@/lib/property-research";
import {
  enqueueDeveloperResearch,
  runQueuedDeveloperResearch,
} from "@/lib/developer-research";
import {
  generateDeveloperPricingRequest,
  generateDeveloperRelationshipDraft,
  scoreDeveloperMatches,
} from "@/lib/database";
import { createAutomaticSellerDraft } from "@/lib/seller-engagement";
import {
  agentTaskDedupeKey,
  shouldRequeueDedupeWinner,
} from "@/lib/agent-task-dedup";
import { underwriteAgentOpportunity } from "@/lib/agent-profit-underwriting";
import { readAgentSchedulerHealth } from "@/lib/agent-scheduler";
import { analyzeEvidenceWithNvidia } from "@/lib/nvidia-reasoning";

const TEAM: Array<{ role: AgentRole; name: string; description: string }> = [
  {
    role: "OPERATIONS_COORDINATOR",
    name: "Operations Coordinator",
    description: "Coordinates evidence-backed work and owner handoffs.",
  },
  {
    role: "RESEARCH",
    name: "Research Agent",
    description: "Refreshes public-source property and developer evidence.",
  },
  {
    role: "SELLER_ACQUISITION",
    name: "Seller Acquisition Agent",
    description:
      "Assesses objective seller and transaction fit without contacting anyone.",
  },
  {
    role: "BUYER_DEVELOPER",
    name: "Developer Relationships Agent",
    description:
      "Finds contactable developers, builds relationship context and buy boxes, then matches transaction-ready buyers.",
  },
  {
    role: "PROFIT_UNDERWRITING",
    name: "Profit Underwriting Agent",
    description:
      "Calculates evidence-backed, non-guaranteed profit and blocks invented numbers.",
  },
  {
    role: "COMMUNICATIONS_DISPOSITION",
    name: "Communications and Disposition Agent",
    description:
      "Prepares exact approval packages and delegates approved delivery through gated providers.",
  },
  {
    role: "TRANSACTION_COMPLIANCE",
    name: "Transaction Compliance Agent",
    description:
      "Builds internal checklists and blocks unsupported progression.",
  },
];
const activeTaskStatuses = [
  "QUEUED",
  "IN_PROGRESS",
  "WAITING_FOR_APPROVAL",
] as const;

export async function ensureAgentTeam() {
  const db = getPrisma();
  await Promise.all(
    TEAM.map((member) =>
      db.agent.upsert({
        where: { role: member.role },
        update: { name: member.name, description: member.description },
        create: member,
      }),
    ),
  );
  const agents = await db.agent.findMany({ orderBy: { role: "asc" } });
  const byRole = new Map(agents.map((agent) => [agent.role, agent]));
  for (const taskType of AGENT_TASK_TYPES) {
    const policy = taskActionPolicy[taskType];
    const agent = byRole.get(taskOwner[taskType]);
    if (!agent) continue;
    const mode =
      policy.zone === "GREEN"
        ? "AUTOMATIC_INTERNAL"
        : policy.zone === "YELLOW"
          ? "APPROVAL_REQUIRED"
          : "BLOCKED";
    await db.agentCapabilityGrant.upsert({
      where: {
        agentId_capability_jurisdictionState_channel: {
          agentId: agent.id,
          capability: policy.capability,
          jurisdictionState: "*",
          channel: "*",
        },
      },
      update: { mode },
      create: {
        agentId: agent.id,
        capability: policy.capability,
        mode,
        jurisdictionState: "*",
        channel: "*",
        maximumCostCents: 0,
        minimumEvidenceCount: policy.zone === "GREEN" ? 0 : 1,
      },
    });
  }
  return agents;
}

export async function createTaskIfMissing(input: {
  role: AgentRole;
  taskType: AgentTaskType;
  title: string;
  description: string;
  transactionId?: string;
  propertyId?: string;
  developerId?: string;
  evidenceCount?: number;
  ownerApprovalRequired?: boolean;
  expectedValueCents?: bigint | null;
  expectedBenefit?: string;
  materialRisks?: string[];
}) {
  const db = getPrisma();
  const agent = await db.agent.findUniqueOrThrow({
    where: { role: input.role },
  });
  const dedupeKey = agentTaskDedupeKey({
    agentId: agent.id,
    taskType: input.taskType,
    transactionId: input.transactionId,
    propertyId: input.propertyId,
    developerId: input.developerId,
  });
  const recentCutoff = new Date(Date.now() - 24 * 60 * 60_000);
  const existing = await db.agentTask.findFirst({
    where: {
      assignedAgentId: agent.id,
      taskType: input.taskType,
      transactionId: input.transactionId,
      propertyId: input.propertyId,
      developerId: input.developerId,
      OR: [
        { status: { in: [...activeTaskStatuses] } },
        { status: "COMPLETED", updatedAt: { gte: recentCutoff } },
      ],
    },
  });
  if (existing) return existing;
  let task;
  let created = false;
  let requeued = false;
  const action = taskActionPolicy[input.taskType];
  try {
    task = await db.agentTask.create({
      data: {
        dedupeKey,
        assignedAgentId: agent.id,
        taskType: input.taskType,
        title: input.title,
        description: input.description,
        transactionId: input.transactionId,
        propertyId: input.propertyId,
        developerId: input.developerId,
        evidenceCount: input.evidenceCount ?? 0,
        ownerApprovalRequired:
          input.ownerApprovalRequired ?? action.zone === "YELLOW",
        actionZone: action.zone,
        costClass: action.costClass,
        capability: action.capability,
        estimatedCostCents: 0,
        expectedValueCents: input.expectedValueCents,
        expectedBenefit: input.expectedBenefit,
        materialRisks: input.materialRisks ?? [],
      },
    });
    created = true;
  } catch (error) {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== "P2002"
    )
      throw error;
    task = await db.agentTask.findUniqueOrThrow({ where: { dedupeKey } });
    if (shouldRequeueDedupeWinner(task.status)) {
      task = await db.agentTask.update({
        where: { id: task.id },
        data: {
          status: "QUEUED",
          output: Prisma.JsonNull,
          startedAt: null,
          completedAt: null,
        },
      });
      requeued = true;
    }
  }
  if (created)
    await db.agentEvent.create({
      data: {
        taskId: task.id,
        actorAgentId: agent.id,
        type: "TASK_CREATED",
        summary: `${agent.name} queued ${task.title}.`,
      },
    });
  if (requeued)
    await db.agentEvent.create({
      data: {
        taskId: task.id,
        actorAgentId: agent.id,
        type: "TASK_UPDATED",
        summary: `${agent.name} requeued ${task.title} after the prior attempt failed or was cancelled.`,
      },
    });
  return task;
}

export async function seedAgentWork() {
  const db = getPrisma();
  await ensureAgentTeam();
  let propertiesConsidered = 0;
  let developersConsidered = 0;
  let transactionsConsidered = 0;
  await createTaskIfMissing({
    role: "OPERATIONS_COORDINATOR",
    taskType: "COORDINATE_PIPELINE",
    title: "Review operating pipeline",
    description: "Summarize active, held, and owner-review work.",
    ownerApprovalRequired: false,
  });
  let propertyCursor: string | undefined;
  while (true) {
    const page = await db.property.findMany({
      where: { opportunityStatus: { not: "REJECTED" } },
      include: {
        researchFindings: true,
        matches: {
          include: { developer: true },
          orderBy: { score: "desc" },
          take: 1,
        },
      },
      orderBy: { id: "asc" },
      take: 100,
      ...(propertyCursor ? { cursor: { id: propertyCursor }, skip: 1 } : {}),
    });
    for (const property of page) {
      propertiesConsidered += 1;
      const evidenceCount = property.researchFindings.filter(
        (item) => item.status === "VERIFIED",
      ).length;
      await createTaskIfMissing({
        role: "RESEARCH",
        taskType: "RESEARCH_PROPERTY",
        title: `Refresh ${property.address}`,
        description:
          "Refresh configured public sources and preserve manual-verification gaps.",
        propertyId: property.id,
        evidenceCount,
        ownerApprovalRequired: false,
      });
      if (
        property.contactPhone ||
        property.contactUrl ||
        property.verificationSourceUrl ||
        property.sourceUrl
      )
        await createTaskIfMissing({
          role: "SELLER_ACQUISITION",
          taskType: "DRAFT_SELLER_OUTREACH",
          title: `Draft seller conversation · ${property.address}`,
          description:
            "Draft a brief inquiry from Tay at Coleman & Co. Ask about the seller's plans without assuming distress or intent to sell. Use only known facts, preserve required disclosures, and do not send anything.",
          propertyId: property.id,
          evidenceCount,
          ownerApprovalRequired: false,
        });
    }
    if (page.length < 100) break;
    propertyCursor = page.at(-1)!.id;
  }
  let developerCursor: string | undefined;
  while (true) {
    const page = await db.developer.findMany({
      where: { active: true },
      orderBy: { id: "asc" },
      take: 100,
      ...(developerCursor ? { cursor: { id: developerCursor }, skip: 1 } : {}),
    });
    for (const developer of page) {
      developersConsidered += 1;
      await createTaskIfMissing({
        role: "RESEARCH",
        taskType: "RESEARCH_DEVELOPER",
        title: `Refresh ${developer.companyName}`,
        description: "Refresh official public-source developer evidence.",
        developerId: developer.id,
        evidenceCount: developer.contactVerifiedAt ? 1 : 0,
        ownerApprovalRequired: false,
      });
      if (
        developer.email ||
        developer.phone ||
        developer.contactUrl ||
        developer.website
      )
        await createTaskIfMissing({
          role: "BUYER_DEVELOPER",
          taskType: "DRAFT_BUYER_OUTREACH",
          title: `Prepare relationship conversation · ${developer.companyName}`,
          description:
            "Draft a brief, personal inquiry from Tay at Coleman & Co. Ask what a good opportunity looks like for the buyer's team. No pitch, invented familiarity, property presentation, or delivery.",
          developerId: developer.id,
          evidenceCount: developer.contactVerifiedAt ? 1 : 0,
          ownerApprovalRequired: false,
        });
    }
    if (page.length < 100) break;
    developerCursor = page.at(-1)!.id;
  }
  let transactionCursor: string | undefined;
  while (true) {
    const page = await db.dealTransaction.findMany({
      where: { controlStatus: { not: "STOPPED" } },
      include: { property: true, documents: true, approvals: true },
      orderBy: { id: "asc" },
      take: 100,
      ...(transactionCursor
        ? { cursor: { id: transactionCursor }, skip: 1 }
        : {}),
    });
    for (const transaction of page) {
      transactionsConsidered += 1;
      await createTaskIfMissing({
        role: "TRANSACTION_COMPLIANCE",
        taskType: "REVIEW_COMPLIANCE_EVIDENCE",
        title: `Review controls · ${transaction.property.address}`,
        description:
          "List missing documents, approvals, counsel, and compliance evidence.",
        transactionId: transaction.id,
        propertyId: transaction.propertyId,
        evidenceCount:
          transaction.documents.length + transaction.approvals.length,
        ownerApprovalRequired: false,
      });
    }
    if (page.length < 100) break;
    transactionCursor = page.at(-1)!.id;
  }
  return {
    properties: propertiesConsidered,
    developers: developersConsidered,
    transactions: transactionsConsidered,
  };
}

async function performTask(task: Awaited<ReturnType<typeof loadTask>>) {
  if (!task) throw new Error("Agent task not found.");
  const taskType = task.taskType as AgentTaskType;
  if (!AGENT_TASK_TYPES.includes(taskType))
    throw new Error("Unsupported agent task type.");
  if (taskType === "RESEARCH_PROPERTY" && task.propertyId) {
    const current = await getPrisma().propertyResearchRun.findFirst({
      where: {
        propertyId: task.propertyId,
        status: { in: ["COMPLETE", "NEEDS_MANUAL_VERIFICATION"] },
        finishedAt: { gte: new Date(Date.now() - 7 * 86_400_000) },
      },
      orderBy: { finishedAt: "desc" },
    });
    return current
      ? {
          summary:
            "Current property research reused without a duplicate external scan.",
          output: {
            researchRunId: current.id,
            status: current.status,
            reused: true,
          },
        }
      : {
          summary: "Property research completed.",
          output: await researchProperty(task.propertyId),
        };
  }
  if (taskType === "RESEARCH_DEVELOPER" && task.developerId) {
    const queued = await enqueueDeveloperResearch(task.developerId);
    return {
      summary: "Developer research processed.",
      output: await runQueuedDeveloperResearch(queued.id),
    };
  }
  if (taskType === "MATCH_BUYER" && task.propertyId) {
    const matches = await scoreDeveloperMatches(task.propertyId, true);
    return {
      summary: `${matches.length} developer relationship prospects ranked for owner review.`,
      output: { matches: matches.slice(0, 10) },
    };
  }
  if (taskType === "ASSESS_SELLER_FIT")
    return {
      summary:
        "Seller-fit checklist prepared; authority, consent, goals, and minimum proceeds remain owner-verified fields.",
      output: {
        verifiedPropertyEvidence: task.evidenceCount,
        contactAttempted: false,
        protectedTraitsUsed: false,
      },
    };
  if (taskType === "DRAFT_SELLER_OUTREACH" && task.propertyId) {
    const draft = await createAutomaticSellerDraft(task.propertyId);
    return draft.created
      ? {
          summary: `Seller conversation draft prepared for owner review${draft.missing.length ? `; it requests missing ${draft.missing.join(" and ")}.` : "."}`,
          output: { ...draft, contactAttempted: false },
        }
      : {
          summary: `Seller conversation draft needs ${draft.missing.join(" and ")} before contact is possible.`,
          output: { ...draft, contactAttempted: false },
        };
  }
  if (taskType === "DRAFT_BUYER_OUTREACH" && task.developerId) {
    const draft = task.propertyId
      ? await generateDeveloperPricingRequest(task.propertyId, task.developerId)
      : await generateDeveloperRelationshipDraft(task.developerId);
    if (!draft)
      throw new Error("Developer conversation draft could not be created.");
    return {
      summary: `Developer pricing conversation draft prepared for ${draft.recipientLabel}; no message was sent.`,
      output: { approvalId: draft.id, contactAttempted: false },
    };
  }
  if (taskType === "UNDERWRITE_PROFIT" && task.propertyId) {
    const db = getPrisma();
    const [property, funnel, match] = await Promise.all([
      db.property.findUniqueOrThrow({
        where: { id: task.propertyId },
        include: {
          researchFindings: true,
          transactions: {
            include: {
              financialProjections: { orderBy: { version: "desc" }, take: 1 },
            },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      }),
      db.acquisitionFunnel.findFirst({
        where: { propertyId: task.propertyId },
        include: {
          buyerPriceEvidence: { orderBy: { createdAt: "desc" }, take: 1 },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.developerMatch.findFirst({
        where: { propertyId: task.propertyId },
        orderBy: { score: "desc" },
      }),
    ]);
    const projection =
      property.transactions[0]?.financialProjections[0] ?? null;
    const buyer = funnel?.buyerPriceEvidence[0] ?? null;
    const knownCosts = projection
      ? projection.transactionCostsCents +
        projection.doubleClosingCostsCents +
        projection.titleExpensesCents +
        projection.closingExpensesCents +
        projection.transactionalFundingCents +
        projection.financingCostsCents +
        projection.taxesCents +
        projection.liensAndPayoffsCents +
        projection.concessionsCents +
        projection.inspectionExpensesCents +
        projection.legalExpensesCents +
        projection.dataMarketingCostsCents +
        projection.insuranceExpensesCents +
        projection.otherExpensesCents +
        projection.contingencyReserveCents
      : null;
    const result = underwriteAgentOpportunity({
      sellerPriceCents:
        projection?.sellerContractPriceCents ??
        (property.estimatedValue
          ? BigInt(property.estimatedValue) * BigInt(100)
          : null),
      sellerPriceVerified: Boolean(
        projection ||
        (property.estimatedValue && property.verificationSourceUrl),
      ),
      buyerLowCents: projection?.buyerPriceLowCents ?? buyer?.lowCents ?? null,
      buyerBaseCents:
        projection?.buyerPriceBaseCents ?? buyer?.baseCents ?? null,
      buyerHighCents:
        projection?.buyerPriceHighCents ?? buyer?.highCents ?? null,
      buyerPriceStatus: projection?.buyerPriceStatus ?? buyer?.status ?? null,
      buyerPriceCurrent: Boolean(
        projection
          ? projection.buyerPriceExpiresAt > new Date()
          : buyer && buyer.expiresAt > new Date(),
      ),
      knownCostsCents: knownCosts,
      riskReserveCents: projection?.riskReserveCents ?? null,
      evidenceCount: property.researchFindings.filter(
        (finding) => finding.status === "VERIFIED",
      ).length,
      buyerMatchScore: match?.score ?? null,
    });
    return {
      summary: result.ready
        ? `Evidence-backed profit underwriting completed with a ${result.score ?? 0}/100 priority score.`
        : `${result.blockers.length} underwriting evidence gaps require research.`,
      output: result,
    };
  }
  if (taskType === "PREPARE_ACTION_PACKAGE" && task.propertyId) {
    const underwriting = await getPrisma().agentTask.findFirst({
      where: {
        propertyId: task.propertyId,
        taskType: "UNDERWRITE_PROFIT",
        status: "COMPLETED",
      },
      orderBy: { completedAt: "desc" },
    });
    const nvidiaEvidenceAnalysis = await analyzeEvidenceWithNvidia({
      propertyId: task.propertyId,
      expectedBenefit: task.expectedBenefit,
      expectedValueCents: task.expectedValueCents?.toString() ?? null,
      evidenceCount: task.evidenceCount,
      materialRisks: task.materialRisks,
      underwriting: underwriting?.output ?? null,
    });
    return {
      summary:
        "An exact owner action package was prepared; no external contact occurred.",
      output: {
        proposedAction:
          "Review the evidence-backed opportunity and authorize one specific next action.",
        affectedPropertyId: task.propertyId,
        expectedBenefit: task.expectedBenefit,
        expectedValueCents: task.expectedValueCents?.toString() ?? null,
        supportingUnderwriting: underwriting?.output ?? null,
        nvidiaEvidenceAnalysis,
        reversible: true,
        contactAttempted: false,
        requiresExactOwnerApproval: true,
      },
    };
  }
  if (
    (taskType === "REVIEW_COMPLIANCE_EVIDENCE" ||
      taskType === "PREPARE_DOCUMENT_CHECKLIST") &&
    task.transaction
  ) {
    const missing = [
      !task.transaction.counselApprovedAt && "counsel approval",
      !task.transaction.complianceVerifiedAt && "compliance verification",
      task.transaction.documents.length === 0 && "transaction documents",
      task.transaction.approvals.length === 0 && "owner approvals",
    ].filter(Boolean);
    return {
      summary: missing.length
        ? `${missing.length} compliance gates remain.`
        : "Recorded compliance gates are present for owner review.",
      output: {
        missing,
        controlStatus: task.transaction.controlStatus,
        documents: task.transaction.documents.length,
        approvals: task.transaction.approvals.length,
      },
    };
  }
  if (taskType === "COORDINATE_PIPELINE") {
    const counts = await getPrisma().agentTask.groupBy({
      by: ["status"],
      _count: true,
    });
    return {
      summary: "Pipeline status summarized for the owner.",
      output: { counts },
    };
  }
  return {
    summary: "Internal work product prepared.",
    output: { contactAttempted: false, irreversibleActionTaken: false },
  };
}

async function chainCompletedAgentTask(
  task: NonNullable<Awaited<ReturnType<typeof loadTask>>>,
  output: unknown,
) {
  if (!task.propertyId) return;
  const db = getPrisma();
  const property = await db.property.findUnique({
    where: { id: task.propertyId },
    select: {
      address: true,
      researchFindings: { where: { status: "VERIFIED" }, select: { id: true } },
    },
  });
  if (!property) return;
  const evidenceCount = property.researchFindings.length;
  if (task.taskType === "RESEARCH_PROPERTY") {
    await Promise.all([
      createTaskIfMissing({
        role: "SELLER_ACQUISITION",
        taskType: "ASSESS_SELLER_FIT",
        title: `Assess seller opportunity · ${property.address}`,
        description:
          "Evaluate evidence-backed seller opportunity without contacting anyone.",
        transactionId: task.transactionId ?? undefined,
        propertyId: task.propertyId,
        evidenceCount,
        ownerApprovalRequired: false,
      }),
      createTaskIfMissing({
        role: "BUYER_DEVELOPER",
        taskType: "MATCH_BUYER",
        title: `Match developer prospects · ${property.address}`,
        description:
          "Rank contactable developer prospects and documented buy-box matches without outreach.",
        transactionId: task.transactionId ?? undefined,
        propertyId: task.propertyId,
        evidenceCount,
        ownerApprovalRequired: false,
      }),
    ]);
  }
  if (task.taskType === "ASSESS_SELLER_FIT") {
    await createTaskIfMissing({
      role: "SELLER_ACQUISITION",
      taskType: "DRAFT_SELLER_OUTREACH",
      title: `Draft seller conversation · ${property.address}`,
      description:
        "Draft a brief inquiry from Tay at Coleman & Co. Ask about the seller's plans without assuming distress or intent to sell. Use only known facts, preserve required disclosures, and do not send anything.",
      transactionId: task.transactionId ?? undefined,
      propertyId: task.propertyId,
      evidenceCount,
      ownerApprovalRequired: false,
    });
  }
  if (["ASSESS_SELLER_FIT", "MATCH_BUYER"].includes(task.taskType)) {
    const completed = await db.agentTask.findMany({
      where: {
        propertyId: task.propertyId,
        taskType: { in: ["ASSESS_SELLER_FIT", "MATCH_BUYER"] },
        status: "COMPLETED",
      },
      select: { taskType: true },
    });
    if (new Set(completed.map((item) => item.taskType)).size === 2)
      await createTaskIfMissing({
        role: "PROFIT_UNDERWRITING",
        taskType: "UNDERWRITE_PROFIT",
        title: `Underwrite profit · ${property.address}`,
        description:
          "Calculate only evidence-backed, non-guaranteed profit and identify missing financial facts.",
        transactionId: task.transactionId ?? undefined,
        propertyId: task.propertyId,
        evidenceCount,
        ownerApprovalRequired: false,
      });
  }
  if (task.taskType === "UNDERWRITE_PROFIT") {
    const result = output as {
      ready?: boolean;
      projected?: { feeBaseCents?: string | null };
      blockers?: string[];
    };
    if (result.ready)
      await createTaskIfMissing({
        role: "COMMUNICATIONS_DISPOSITION",
        taskType: "PREPARE_ACTION_PACKAGE",
        title: `Prepare next action · ${property.address}`,
        description:
          "Prepare the exact action, evidence, expected benefit, cost, and risks for owner review.",
        transactionId: task.transactionId ?? undefined,
        propertyId: task.propertyId,
        evidenceCount,
        ownerApprovalRequired: false,
        expectedValueCents: result.projected?.feeBaseCents
          ? BigInt(result.projected.feeBaseCents)
          : null,
        expectedBenefit:
          "Advance a verified opportunity toward an approved seller or buyer conversation.",
        materialRisks: result.blockers ?? [],
      });
  }
  if (task.taskType === "PREPARE_ACTION_PACKAGE")
    await createTaskIfMissing({
      role: "OPERATIONS_COORDINATOR",
      taskType: "REQUEST_OWNER_APPROVAL",
      title: `Decision ready · ${property.address}`,
      description:
        "Review one specific next action. Approval does not authorize a campaign or unrelated contact.",
      transactionId: task.transactionId ?? undefined,
      propertyId: task.propertyId,
      evidenceCount,
      ownerApprovalRequired: true,
      expectedValueCents: task.expectedValueCents,
      expectedBenefit: task.expectedBenefit ?? undefined,
      materialRisks: task.materialRisks,
    });
}

async function loadTask(taskId: string) {
  return getPrisma().agentTask.findUnique({
    where: { id: taskId },
    include: {
      assignedAgent: { include: { capabilityGrants: true } },
      transaction: { include: { documents: true, approvals: true } },
    },
  });
}

export async function runAgentTask(taskId: string) {
  const db = getPrisma();
  const task = await loadTask(taskId);
  if (!task || !["QUEUED", "WAITING_FOR_APPROVAL"].includes(task.status))
    return { status: "skipped" as const };
  const taskType = task.taskType as AgentTaskType;
  const autonomyUnlocked =
    task.assignedAgent.autonomyMode === "APPROVED_AUTONOMOUS";
  const grant = task.assignedAgent.capabilityGrants.find(
    (item) =>
      item.capability === task.capability &&
      !item.suspendedAt &&
      (!item.expiresAt || item.expiresAt > new Date()),
  );
  const decision = evaluateAgentTask({
    role: task.assignedAgent.role,
    taskType,
    transactionControl: task.transaction?.controlStatus,
    ownerApproved: !task.ownerApprovalRequired || Boolean(task.ownerApprovedAt),
    evidenceComplete:
      task.evidenceCount > 0 ||
      [
        "COORDINATE_PIPELINE",
        "RESEARCH_PROPERTY",
        "RESEARCH_DEVELOPER",
        "PREPARE_DOCUMENT_CHECKLIST",
      ].includes(taskType),
    evidenceCount: task.evidenceCount,
    actionZone: task.actionZone,
    costClass: task.costClass,
    estimatedCostCents: task.estimatedCostCents,
    capabilityGrant: grant
      ? {
          mode: grant.mode,
          maximumCostCents: grant.maximumCostCents,
          minimumEvidenceCount: grant.minimumEvidenceCount,
          active: true,
        }
      : undefined,
    operatingMode: autonomyUnlocked ? "AUTONOMOUS" : "SUPERVISED",
    autonomyEvidence: {
      jurisdictionConfigured: Boolean(task.transaction?.jurisdictionState),
      counselApproved: Boolean(task.assignedAgent.counselApprovedAt),
      complianceEvidenceVerified: Boolean(
        task.assignedAgent.complianceApprovedAt,
      ),
      provenComplianceRecord: Boolean(
        task.assignedAgent.legalStandardsProvenAt &&
        task.assignedAgent.ethicalStandardsProvenAt,
      ),
    },
  });
  if (!decision.allowed) {
    const waiting = decision.outcome === "OWNER_APPROVAL_REQUIRED";
    await db.$transaction([
      db.agentTask.update({
        where: { id: task.id },
        data: {
          status: waiting ? "WAITING_FOR_APPROVAL" : "BLOCKED",
          output: { reasons: decision.reasons },
        },
      }),
      db.agentEvent.create({
        data: {
          taskId: task.id,
          actorAgentId: task.assignedAgentId,
          type: waiting ? "APPROVAL_REQUESTED" : "TASK_UPDATED",
          summary: decision.reasons.join(" "),
        },
      }),
    ]);
    return {
      status: waiting ? ("waiting" as const) : ("blocked" as const),
      reasons: decision.reasons,
    };
  }
  const run = await db.$transaction(async (tx) => {
    await tx.agentTask.update({
      where: { id: task.id },
      data: {
        status: "IN_PROGRESS",
        startedAt: new Date(),
        attemptCount: { increment: 1 },
      },
    });
    const created = await tx.agentRun.create({
      data: { agentId: task.assignedAgentId, taskId: task.id },
    });
    await tx.agentEvent.create({
      data: {
        taskId: task.id,
        runId: created.id,
        actorAgentId: task.assignedAgentId,
        type: "TASK_STARTED",
        summary: `${task.assignedAgent.name} started ${task.title}.`,
      },
    });
    return created;
  });
  try {
    const result = await performTask(task);
    await db.$transaction([
      db.agentTask.update({
        where: { id: task.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          output: result.output as Prisma.InputJsonValue,
        },
      }),
      db.agentRun.update({
        where: { id: run.id },
        data: {
          status: "COMPLETED",
          summary: result.summary,
          finishedAt: new Date(),
        },
      }),
      db.agentEvent.create({
        data: {
          taskId: task.id,
          runId: run.id,
          actorAgentId: task.assignedAgentId,
          type: "TASK_COMPLETED",
          summary: result.summary,
        },
      }),
    ]);
    await chainCompletedAgentTask(task, result.output);
    return { status: "completed" as const, summary: result.summary };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Agent task failed.";
    await db.$transaction([
      db.agentTask.update({
        where: { id: task.id },
        data: { status: "FAILED", output: { error: message } },
      }),
      db.agentRun.update({
        where: { id: run.id },
        data: { status: "FAILED", error: message, finishedAt: new Date() },
      }),
      db.agentEvent.create({
        data: {
          taskId: task.id,
          runId: run.id,
          actorAgentId: task.assignedAgentId,
          type: "RUN_FAILED",
          summary: message,
        },
      }),
    ]);
    return { status: "failed" as const, error: message };
  }
}

export async function runAgentQueue(agentId: string, limit = 3, seed = true) {
  if (seed) await seedAgentWork();
  const tasks = await getPrisma().agentTask.findMany({
    where: { assignedAgentId: agentId, status: "QUEUED" },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    take: Math.max(1, Math.min(limit, 10)),
  });
  const results = [];
  for (const task of tasks) results.push(await runAgentTask(task.id));
  return { processed: results.length, results };
}

export async function runAgentTeamBatch() {
  const agents = await ensureAgentTeam();
  await seedAgentWork();
  const results = [];
  const order: AgentRole[] = [
    "RESEARCH",
    "SELLER_ACQUISITION",
    "BUYER_DEVELOPER",
    "PROFIT_UNDERWRITING",
    "COMMUNICATIONS_DISPOSITION",
    "TRANSACTION_COMPLIANCE",
    "OPERATIONS_COORDINATOR",
  ];
  for (let wave = 0; wave < 3; wave += 1)
    for (const role of order) {
      const agent = agents.find(
        (item) => item.role === role && item.status === "ACTIVE",
      );
      if (agent)
        results.push({
          wave,
          agentId: agent.id,
          ...(await runAgentQueue(agent.id, 10, false)),
        });
    }
  return { agents: results.length, results };
}

export async function runConversationDraftBacklog(limit = 150) {
  const tasks = await getPrisma().agentTask.findMany({
    where: {
      status: "QUEUED",
      taskType: { in: ["DRAFT_SELLER_OUTREACH", "DRAFT_BUYER_OUTREACH"] },
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    take: Math.max(1, Math.min(limit, 250)),
    select: { id: true },
  });
  const results = [];
  for (let offset = 0; offset < tasks.length; offset += 5) {
    const batch = tasks.slice(offset, offset + 5);
    results.push(
      ...(await Promise.all(batch.map(({ id }) => runAgentTask(id)))),
    );
  }
  return {
    queued: tasks.length,
    processed: results.filter((result) => result.status !== "skipped").length,
    results,
  };
}

export async function reviewAgentTask(
  taskId: string,
  approved: boolean,
  note: string,
) {
  if (!approved && !note.trim())
    throw new Error("A rejection reason is required.");
  const db = getPrisma();
  const task = await db.agentTask.findUnique({
    where: { id: taskId },
    include: { transaction: true },
  });
  if (!task) throw new Error("Agent task not found.");
  if (task.transaction?.controlStatus === "STOPPED")
    throw new Error("A stopped transaction cannot receive agent approval.");
  const status = approved ? "QUEUED" : "CANCELLED";
  await db.$transaction([
    db.agentTask.update({
      where: { id: taskId },
      data: {
        status,
        ownerApprovedAt: approved ? new Date() : null,
        ownerApprovedBy: approved ? "owner" : null,
        approvalReason:
          note.trim() ||
          (approved ? "Owner approved internal processing." : null),
      },
    }),
    db.agentEvent.create({
      data: {
        taskId,
        type: "APPROVAL_DECIDED",
        summary: approved
          ? "Owner approved internal agent work."
          : `Owner rejected agent work: ${note.trim()}`,
      },
    }),
  ]);
  return { status };
}

export async function updateAgentStatus(
  agentId: string,
  status: "ACTIVE" | "PAUSED" | "DISABLED",
) {
  const db = getPrisma();
  const agent = await db.agent.findUnique({ where: { id: agentId } });
  if (!agent) throw new Error("Agent not found.");
  await db.$transaction([
    db.agent.update({ where: { id: agentId }, data: { status } }),
    db.auditLog.create({
      data: {
        type: "agent.status_changed",
        summary: `${agent.name} was set to ${status.toLowerCase()} by the owner.`,
        details: {
          agentId,
          previousStatus: agent.status,
          status,
          actor: "owner",
        },
      },
    }),
  ]);
  return { status };
}

export async function updateAgentAutonomy(
  agentId: string,
  autonomyMode: "LOCKED" | "SUPERVISED" | "APPROVED_AUTONOMOUS",
) {
  const db = getPrisma();
  const agent = await db.agent.findUnique({
    where: { id: agentId },
    include: {
      assignedTasks: {
        select: { status: true },
        orderBy: { updatedAt: "desc" },
        take: 30,
      },
    },
  });
  if (!agent) throw new Error("Agent not found.");
  const gates = [
    agent.legalStandardsProvenAt,
    agent.ethicalStandardsProvenAt,
    agent.complianceApprovedAt,
    agent.counselApprovedAt,
    agent.ownerAutonomyApprovedAt,
  ];
  if (autonomyMode === "APPROVED_AUTONOMOUS" && gates.some((gate) => !gate))
    throw new Error(
      "Autonomy remains locked until every legal, ethical, compliance, counsel, and owner gate is recorded.",
    );
  if (
    autonomyMode === "APPROVED_AUTONOMOUS" &&
    !evaluateSupervisedTrackRecord(
      agent.assignedTasks.map((task) => task.status),
    ).eligible
  )
    throw new Error(
      "Autonomy remains locked until the agent has 30 consecutive completed supervised tasks without a failed, blocked, cancelled, or unfinished task.",
    );
  await db.$transaction([
    db.agent.update({
      where: { id: agentId },
      data: { autonomyMode, autonomousOutbound: false },
    }),
    db.auditLog.create({
      data: {
        type: "agent.autonomy_changed",
        summary: `${agent.name} was set to ${autonomyMode.toLowerCase().replaceAll("_", " ")} by the owner. Outbound remains disabled.`,
        details: {
          agentId,
          previousMode: agent.autonomyMode,
          autonomyMode,
          autonomousOutbound: false,
          actor: "owner",
        },
      },
    }),
  ]);
  return { autonomyMode };
}

export async function readAgentDashboard() {
  await ensureAgentTeam();
  const db = getPrisma();
  const [agents, approvalTasks, recentTasks, events, scheduler] =
    await Promise.all([
      db.agent.findMany({
        include: {
          assignedTasks: {
            select: { status: true },
            orderBy: { updatedAt: "desc" },
          },
          runs: { orderBy: { startedAt: "desc" }, take: 1 },
        },
        orderBy: { role: "asc" },
      }),
      db.agentTask.findMany({
        where: { status: "WAITING_FOR_APPROVAL" },
        include: {
          assignedAgent: true,
          transaction: { include: { property: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 30,
      }),
      db.agentTask.findMany({
        include: {
          assignedAgent: true,
          transaction: { include: { property: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 30,
      }),
      db.agentEvent.findMany({
        include: {
          actorAgent: true,
          task: { include: { assignedAgent: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      readAgentSchedulerHealth(),
    ]);
  const taskSummary = (task: (typeof recentTasks)[number]) => ({
    id: task.id,
    title: task.title,
    agentId: task.assignedAgentId,
    agentName: task.assignedAgent.name,
    status: task.status,
    transactionLabel: task.transaction?.property.address ?? null,
    evidenceCount: task.evidenceCount,
    actionZone: task.actionZone,
    capability: task.capability,
    estimatedCostCents: task.estimatedCostCents.toString(),
    expectedValueCents: task.expectedValueCents?.toString() ?? null,
    expectedBenefit: task.expectedBenefit,
    materialRisks: task.materialRisks,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  });
  return {
    scheduler,
    agents: agents.map((agent) => {
      const statuses = agent.assignedTasks.map((task) => task.status);
      const trackRecord = evaluateSupervisedTrackRecord(statuses);
      const blockers = [
        !agent.legalStandardsProvenAt && "legal proof",
        !agent.ethicalStandardsProvenAt && "ethical proof",
        !agent.complianceApprovedAt && "compliance approval",
        !agent.counselApprovedAt && "counsel approval",
        !agent.ownerAutonomyApprovedAt && "owner approval",
        ...trackRecord.blockers,
      ].filter(Boolean) as string[];
      return {
        id: agent.id,
        name: agent.name,
        role: agent.role.replaceAll("_", " "),
        status: agent.status,
        autonomyMode: agent.autonomyMode,
        autonomousOutbound: agent.autonomousOutbound,
        queuedTasks: statuses.filter((value) => value === "QUEUED").length,
        activeTasks: statuses.filter((value) => value === "IN_PROGRESS").length,
        approvalTasks: statuses.filter(
          (value) => value === "WAITING_FOR_APPROVAL",
        ).length,
        completedTasks: statuses.filter((value) => value === "COMPLETED")
          .length,
        lastActiveAt: agent.runs[0]?.startedAt.toISOString() ?? null,
        autonomyEligible: blockers.length === 0,
        autonomyBlockers: [...new Set(blockers)],
      };
    }),
    approvalTasks: approvalTasks.map(taskSummary),
    recentTasks: recentTasks.map(taskSummary),
    events: events.map((event) => ({
      id: event.id,
      agentName: event.actorAgent?.name || event.task.assignedAgent.name,
      summary: event.summary,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}
