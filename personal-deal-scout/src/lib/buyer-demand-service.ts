import "server-only";

import {
  Prisma,
  type BuyerIssueStatus,
  type BuyerPermissionStatus,
  type BuyerPriceStatus,
  type EngagementChannel,
} from "@prisma/client";
import {
  calculateBuyerReliability,
  validateBuyerReliabilityWeights,
  validatePropertyBuyerPrice,
  type BuyerReliabilityInput,
  type BuyerReliabilityWeights,
} from "@/lib/buyer-reliability";
import { getPrisma } from "@/lib/prisma";

const secureUrl = (raw: string) => {
  const url = new URL(raw);
  if (url.protocol !== "https:")
    throw new Error("Evidence URLs must use HTTPS.");
  return url.toString();
};
export async function recordBuyerPropertyPrice(input: {
  developerId: string;
  demandVersionId: string;
  funnelId: string;
  status: BuyerPriceStatus;
  lowCents: bigint;
  baseCents: bigint;
  highCents: bigint;
  assumptions: string[];
  sourceUrl: string;
  observedAt: Date;
  expiresAt: Date;
  reviewer?: string;
  reviewedAt?: Date;
}) {
  const now = new Date();
  const decision = validatePropertyBuyerPrice({ ...input, now });
  if (!decision.verified && ["DOCUMENTED", "COMMITTED"].includes(input.status))
    throw new Error(
      `Buyer pricing is not verified: ${decision.blockers.join(", ")}`,
    );
  return getPrisma().$transaction(
    async (tx) => {
      const latest = await tx.buyerPropertyPriceEvidence.findFirst({
        where: { developerId: input.developerId, funnelId: input.funnelId },
        orderBy: { version: "desc" },
      });
      const record = await tx.buyerPropertyPriceEvidence.create({
        data: {
          ...input,
          sourceUrl: secureUrl(input.sourceUrl),
          version: (latest?.version ?? 0) + 1,
          reviewedBy: input.reviewer,
          reviewedAt: input.reviewedAt,
        },
      });
      await tx.auditLog.create({
        data: {
          type: "buyer.property_price.versioned",
          summary: `Recorded property-specific buyer price version ${record.version}.`,
          details: {
            recordId: record.id,
            funnelId: record.funnelId,
            status: record.status,
            blockers: decision.blockers,
          },
        },
      });
      return record;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function recordBuyerCapacity(input: {
  developerId: string;
  amountCents?: bigint;
  sourceUrl: string;
  artifactHash?: string;
  observedAt: Date;
  expiresAt: Date;
  reviewer: string;
  verified: boolean;
}) {
  if (input.expiresAt <= input.observedAt || input.observedAt > new Date())
    throw new Error("Proof-of-funds dates are invalid.");
  if (input.artifactHash && !/^[a-f0-9]{64}$/i.test(input.artifactHash))
    throw new Error("Artifact hash must be SHA-256.");
  return getPrisma().$transaction(
    async (tx) => {
      const latest = await tx.buyerCapacityEvidence.findFirst({
        where: { developerId: input.developerId },
        orderBy: { version: "desc" },
      });
      return tx.buyerCapacityEvidence.create({
        data: {
          developerId: input.developerId,
          version: (latest?.version ?? 0) + 1,
          status: input.verified ? "VERIFIED" : "PENDING",
          amountCents: input.amountCents,
          sourceUrl: secureUrl(input.sourceUrl),
          artifactHash: input.artifactHash,
          observedAt: input.observedAt,
          expiresAt: input.expiresAt,
          verifiedBy: input.verified ? input.reviewer : undefined,
          verifiedAt: input.verified ? new Date() : undefined,
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function recordBuyerReliabilityEvidence(input: {
  developerId: string;
  completedClosings: number;
  failedClosings: number;
  retrades: number;
  responsesMeasured: number;
  averageResponseHours?: number;
  unresolvedIssues: number;
  averageCloseDays?: number;
  sourceUrl: string;
  expiresAt: Date;
  reviewer: string;
  verified: boolean;
}) {
  const counts = [
    input.completedClosings,
    input.failedClosings,
    input.retrades,
    input.responsesMeasured,
    input.unresolvedIssues,
  ];
  if (
    counts.some((value) => !Number.isInteger(value) || value < 0) ||
    input.expiresAt <= new Date()
  )
    throw new Error(
      "Reliability observations require nonnegative counts and a future expiry.",
    );
  if (
    (input.averageResponseHours !== undefined &&
      input.averageResponseHours < 0) ||
    (input.averageCloseDays !== undefined && input.averageCloseDays < 0)
  )
    throw new Error("Reliability durations cannot be negative.");
  const sourceUrl = secureUrl(input.sourceUrl);
  const db = getPrisma();
  return db.$transaction(
    async (tx) => {
      const latest = await tx.buyerReliabilityEvidence.findFirst({
        where: { developerId: input.developerId },
        orderBy: { version: "desc" },
      });
      return tx.buyerReliabilityEvidence.create({
        data: {
          developerId: input.developerId,
          version: (latest?.version ?? 0) + 1,
          status: input.verified ? "VERIFIED" : "PENDING",
          completedClosings: input.completedClosings,
          failedClosings: input.failedClosings,
          retrades: input.retrades,
          responsesMeasured: input.responsesMeasured,
          averageResponseHours: input.averageResponseHours,
          unresolvedIssues: input.unresolvedIssues,
          averageCloseDays: input.averageCloseDays,
          sourceUrl,
          verifiedBy: input.verified ? input.reviewer : undefined,
          verifiedAt: input.verified ? new Date() : undefined,
          expiresAt: input.expiresAt,
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function recordBuyerPermission(input: {
  developerId: string;
  channel: EngagementChannel;
  status: BuyerPermissionStatus;
  sourceUrl?: string;
  capturedAt: Date;
  expiresAt?: Date;
  reviewer: string;
}) {
  if (input.sourceUrl) secureUrl(input.sourceUrl);
  const { reviewer, ...data } = input;
  return getPrisma().buyerCommunicationPermission.create({
    data: { ...data, reviewedBy: reviewer },
  });
}
export async function recordBuyerPerformanceIssue(input: {
  developerId: string;
  type: string;
  status: BuyerIssueStatus;
  occurredAt: Date;
  description: string;
  sourceUrl: string;
  resolution?: string;
  resolvedAt?: Date;
  reviewer: string;
}) {
  if (!input.description.trim())
    throw new Error("Issue description is required.");
  const { reviewer, ...data } = input;
  return getPrisma().buyerPerformanceIssue.create({
    data: {
      ...data,
      sourceUrl: secureUrl(data.sourceUrl),
      reviewedBy: reviewer,
    },
  });
}

export async function createBuyerReliabilityConfiguration(input: {
  weights: BuyerReliabilityWeights;
  reason: string;
  actor: string;
  effectiveAt?: Date;
  expiresAt?: Date;
}) {
  validateBuyerReliabilityWeights(input.weights);
  if (input.reason.trim().length < 10)
    throw new Error("Explain why these weights were selected.");
  return getPrisma().$transaction(
    async (tx) => {
      const latest = await tx.buyerReliabilityScoreConfiguration.findFirst({
        orderBy: { version: "desc" },
      });
      return tx.buyerReliabilityScoreConfiguration.create({
        data: {
          version: (latest?.version ?? 0) + 1,
          status: "DRAFT",
          financialCapacityWeight: input.weights.financialCapacity,
          marketActivityWeight: input.weights.marketActivity,
          criteriaSpecificityWeight: input.weights.criteriaSpecificity,
          responseTimeWeight: input.weights.responseTime,
          closingRateWeight: input.weights.closingRate,
          pofFreshnessWeight: input.weights.pofFreshness,
          retradePenaltyWeight: input.weights.retradePenalty,
          failedClosingPenaltyWeight: input.weights.failedClosingPenalty,
          unresolvedIssuePenaltyWeight: input.weights.unresolvedIssuePenalty,
          reason: input.reason,
          createdBy: input.actor,
          effectiveAt: input.effectiveAt,
          expiresAt: input.expiresAt,
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function activateBuyerReliabilityConfiguration(input: {
  configurationId: string;
  actor: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  return getPrisma().$transaction(
    async (tx) => {
      const config =
        await tx.buyerReliabilityScoreConfiguration.findUniqueOrThrow({
          where: { id: input.configurationId },
        });
      if (
        config.status !== "DRAFT" ||
        !config.effectiveAt ||
        config.effectiveAt > now ||
        (config.expiresAt && config.expiresAt <= now)
      )
        throw new Error(
          "Only a current draft reliability configuration can be activated.",
        );
      await tx.buyerReliabilityScoreConfiguration.updateMany({
        where: { status: "ACTIVE" },
        data: { status: "RETIRED" },
      });
      const active = await tx.buyerReliabilityScoreConfiguration.update({
        where: { id: config.id },
        data: { status: "ACTIVE" },
      });
      await tx.auditLog.create({
        data: {
          type: "buyer.reliability.configuration.activated",
          summary: `Activated buyer reliability configuration v${config.version}.`,
          details: { configurationId: config.id, actor: input.actor },
        },
      });
      return active;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function persistDerivedBuyerReliabilityScore(input: {
  developerId: string;
  demandVersionId: string;
  reliabilityEvidenceId: string;
  configurationId: string;
  actor: string;
  expiresAt: Date;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const [demand, evidence, capacity] = await Promise.all([
    getPrisma().buyerDemandVersion.findUniqueOrThrow({
      where: { id: input.demandVersionId },
    }),
    getPrisma().buyerReliabilityEvidence.findUniqueOrThrow({
      where: { id: input.reliabilityEvidenceId },
    }),
    getPrisma().buyerCapacityEvidence.findFirst({
      where: {
        developerId: input.developerId,
        status: "VERIFIED",
        expiresAt: { gt: now },
      },
      orderBy: { version: "desc" },
    }),
  ]);
  if (
    !demand.expiresAt ||
    !capacity ||
    evidence.developerId !== input.developerId ||
    demand.developerId !== input.developerId
  )
    throw new Error(
      "Current matching demand, performance, and capacity evidence is required.",
    );
  return persistBuyerReliabilityScore({
    ...input,
    values: {
      financialCapacity: 0,
      marketActivity: 0,
      criteriaSpecificity: 0,
      responseTime: 0,
      closingRate: 0,
      pofFreshness: 0,
      retradeRate: 0,
      failedClosingRate: 0,
      unresolvedIssueSeverity: 0,
      pofExpiresAt: capacity.expiresAt,
      demandExpiresAt: demand.expiresAt,
      communicationAllowed: false,
      now,
    },
  });
}

export async function persistBuyerReliabilityScore(input: {
  developerId: string;
  demandVersionId: string;
  reliabilityEvidenceId: string;
  configurationId: string;
  values: BuyerReliabilityInput;
  actor: string;
  expiresAt: Date;
}) {
  const db = getPrisma();
  const [config, demand, evidence, capacity, permission, openIssues] =
    await Promise.all([
      db.buyerReliabilityScoreConfiguration.findUniqueOrThrow({
        where: { id: input.configurationId },
      }),
      db.buyerDemandVersion.findUniqueOrThrow({
        where: { id: input.demandVersionId },
      }),
      db.buyerReliabilityEvidence.findUniqueOrThrow({
        where: { id: input.reliabilityEvidenceId },
      }),
      db.buyerCapacityEvidence.findFirst({
        where: {
          developerId: input.developerId,
          status: "VERIFIED",
          expiresAt: { gt: input.values.now },
        },
        orderBy: { version: "desc" },
      }),
      db.buyerCommunicationPermission.findFirst({
        where: {
          developerId: input.developerId,
          status: "GRANTED",
          capturedAt: { lte: input.values.now },
          OR: [{ expiresAt: null }, { expiresAt: { gt: input.values.now } }],
        },
        orderBy: { capturedAt: "desc" },
      }),
      db.buyerPerformanceIssue.count({
        where: {
          developerId: input.developerId,
          status: { in: ["OPEN", "DISPUTED"] },
        },
      }),
    ]);
  if (
    demand.developerId !== input.developerId ||
    evidence.developerId !== input.developerId
  )
    throw new Error("Reliability inputs must belong to the same buyer.");
  if (
    demand.status !== "VERIFIED" ||
    !demand.expiresAt ||
    demand.expiresAt <= input.values.now
  )
    throw new Error("Reliability scoring requires current verified demand.");
  if (evidence.status !== "VERIFIED" || evidence.expiresAt <= input.values.now)
    throw new Error(
      "Reliability scoring requires current verified performance evidence.",
    );
  if (
    demand.expiresAt.getTime() !== input.values.demandExpiresAt.getTime() ||
    evidence.expiresAt < input.expiresAt ||
    !capacity ||
    capacity.expiresAt.getTime() !== input.values.pofExpiresAt.getTime()
  )
    throw new Error(
      "Reliability snapshot dates do not match persisted evidence.",
    );
  if (
    config.status !== "ACTIVE" ||
    !config.effectiveAt ||
    config.effectiveAt > input.values.now ||
    (config.expiresAt && config.expiresAt <= input.values.now)
  )
    throw new Error("Reliability configuration is not active.");
  const totalClosings = evidence.completedClosings + evidence.failedClosings;
  const criteriaFields = [
    demand.states.length,
    demand.assetTypes.length,
    demand.currentBuyingStatus,
    demand.criteriaConfirmedAt,
    demand.minPurchasePriceCents ?? demand.maxPurchasePriceCents,
  ].filter(Boolean).length;
  const daysUntilPofExpiry = Math.max(
    0,
    (capacity.expiresAt.getTime() - input.values.now.getTime()) / 86_400_000,
  );
  const derivedValues: BuyerReliabilityInput = {
    financialCapacity:
      capacity.amountCents && capacity.amountCents > BigInt(0) ? 100 : 60,
    marketActivity: Math.min(100, evidence.completedClosings * 10),
    criteriaSpecificity: Math.min(100, criteriaFields * 20),
    responseTime:
      evidence.averageResponseHours == null
        ? 0
        : Math.max(0, 100 - evidence.averageResponseHours * 4),
    closingRate: totalClosings
      ? (evidence.completedClosings / totalClosings) * 100
      : 0,
    pofFreshness: Math.min(100, daysUntilPofExpiry / 0.9),
    retradeRate: evidence.completedClosings
      ? (evidence.retrades / evidence.completedClosings) * 100
      : evidence.retrades
        ? 100
        : 0,
    failedClosingRate: totalClosings
      ? (evidence.failedClosings / totalClosings) * 100
      : 0,
    unresolvedIssueSeverity: Math.min(
      100,
      Math.max(evidence.unresolvedIssues, openIssues) * 20,
    ),
    pofExpiresAt: capacity.expiresAt,
    demandExpiresAt: demand.expiresAt,
    communicationAllowed: Boolean(permission),
    now: input.values.now,
  };
  const weights = {
    financialCapacity: config.financialCapacityWeight,
    marketActivity: config.marketActivityWeight,
    criteriaSpecificity: config.criteriaSpecificityWeight,
    responseTime: config.responseTimeWeight,
    closingRate: config.closingRateWeight,
    pofFreshness: config.pofFreshnessWeight,
    retradePenalty: config.retradePenaltyWeight,
    failedClosingPenalty: config.failedClosingPenaltyWeight,
    unresolvedIssuePenalty: config.unresolvedIssuePenaltyWeight,
  };
  const score = calculateBuyerReliability(derivedValues, weights);
  return db.$transaction(
    async (tx) => {
      const latest = await tx.buyerReliabilityScoreHistory.findFirst({
        where: { developerId: input.developerId },
        orderBy: { version: "desc" },
      });
      return tx.buyerReliabilityScoreHistory.create({
        data: {
          developerId: input.developerId,
          demandVersionId: input.demandVersionId,
          reliabilityEvidenceId: input.reliabilityEvidenceId,
          configurationId: input.configurationId,
          version: (latest?.version ?? 0) + 1,
          totalScore: score.totalScore,
          componentScores: score.components,
          inputSnapshot: JSON.parse(JSON.stringify(derivedValues)),
          reasons: score.explanation,
          blockers: score.blockers,
          expiresAt: input.expiresAt,
          calculatedBy: input.actor,
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function confirmBuyerCoverage(input: {
  funnelId: string;
  demandVersionId: string;
  role: "PRIMARY" | "BACKUP";
  matchScore: number;
  reasons: string[];
  expiresAt: Date;
  actor: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  if (
    !Number.isInteger(input.matchScore) ||
    input.matchScore < 0 ||
    input.matchScore > 100
  )
    throw new Error("Buyer match score must be an integer from 0 to 100.");
  if (!input.reasons.length || input.expiresAt <= now)
    throw new Error("Buyer coverage requires reasons and a future expiry.");
  const db = getPrisma();
  return db.$transaction(
    async (tx) => {
      const demand = await tx.buyerDemandVersion.findUnique({
        where: { id: input.demandVersionId },
      });
      if (
        !demand ||
        demand.status !== "VERIFIED" ||
        !demand.expiresAt ||
        demand.expiresAt <= now
      )
        throw new Error("Current verified buyer demand is required.");
      const [capacity, reliability, price, permission, existingRole] =
        await Promise.all([
          tx.buyerCapacityEvidence.findFirst({
            where: {
              developerId: demand.developerId,
              status: "VERIFIED",
              expiresAt: { gt: now },
            },
            orderBy: { version: "desc" },
          }),
          tx.buyerReliabilityScoreHistory.findFirst({
            where: {
              developerId: demand.developerId,
              demandVersionId: demand.id,
              expiresAt: { gt: now },
            },
            orderBy: { version: "desc" },
          }),
          tx.buyerPropertyPriceEvidence.findFirst({
            where: {
              developerId: demand.developerId,
              demandVersionId: demand.id,
              funnelId: input.funnelId,
              status: { in: ["DOCUMENTED", "COMMITTED"] },
              expiresAt: { gt: now },
              reviewedAt: { not: null },
            },
            orderBy: { version: "desc" },
          }),
          tx.buyerCommunicationPermission.findFirst({
            where: {
              developerId: demand.developerId,
              status: "GRANTED",
              capturedAt: { lte: now },
              OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            },
            orderBy: { capturedAt: "desc" },
          }),
          tx.buyerCoverage.findFirst({
            where: {
              funnelId: input.funnelId,
              role: input.role,
              status: "CONFIRMED",
              expiresAt: { gt: now },
              demandVersionId: { not: demand.id },
            },
          }),
        ]);
      const blockers = [
        !capacity && "proof_of_funds_missing",
        (!reliability || reliability.blockers.length > 0) &&
          "reliability_not_eligible",
        !price && "property_price_not_verified",
        !permission && "communication_permission_missing",
        existingRole &&
          `${input.role.toLowerCase()}_coverage_already_confirmed`,
      ].filter(Boolean) as string[];
      if (blockers.length)
        throw new Error(`Buyer coverage blocked: ${blockers.join(", ")}`);
      const coverage = await tx.buyerCoverage.upsert({
        where: {
          funnelId_demandVersionId: {
            funnelId: input.funnelId,
            demandVersionId: demand.id,
          },
        },
        update: {
          role: input.role,
          status: "CONFIRMED",
          matchScore: input.matchScore,
          reasons: input.reasons,
          evaluatedAt: now,
          confirmedAt: now,
          expiresAt: input.expiresAt,
        },
        create: {
          funnelId: input.funnelId,
          demandVersionId: demand.id,
          role: input.role,
          status: "CONFIRMED",
          matchScore: input.matchScore,
          reasons: input.reasons,
          evaluatedAt: now,
          confirmedAt: now,
          expiresAt: input.expiresAt,
        },
      });
      await tx.auditLog.create({
        data: {
          type: "buyer.coverage.confirmed",
          summary: `Confirmed ${input.role.toLowerCase()} buyer coverage.`,
          details: {
            coverageId: coverage.id,
            funnelId: input.funnelId,
            demandVersionId: demand.id,
            actor: input.actor,
          },
        },
      });
      return coverage;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
