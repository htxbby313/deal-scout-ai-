import "server-only";
import { Prisma, type CampaignCostType } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";
import {
  evaluateCampaignLifecycle,
  evaluateCampaignOpportunity,
} from "@/lib/campaign-economics";
const https = (raw: string) => {
  const url = new URL(raw);
  if (url.protocol !== "https:")
    throw new Error("Evidence URLs must use HTTPS.");
  return url.toString();
};
export async function synchronizeCampaignCountyCoverage() {
  const db = getPrisma();
  const campaigns = await db.acquisitionCampaign.findMany({
    where: { status: { notIn: ["COMPLETED", "CANCELLED"] } },
    include: { boundaries: { orderBy: { version: "desc" }, take: 1 } },
  });
  let covered = 0;
  const unresolved: string[] = [];
  for (const campaign of campaigns) {
    const boundary = campaign.boundaries[0];
    if (!boundary) continue;
    for (const countyName of boundary.allowedCounties) {
      const registry = await db.countySourceRegistry.findFirst({
        where: {
          stateCode: campaign.jurisdictionState,
          countyName: { equals: countyName, mode: "insensitive" },
        },
      });
      if (!registry) {
        unresolved.push(`${campaign.id}:${countyName}`);
        continue;
      }
      await db.campaignCountyCoverage.upsert({
        where: {
          campaignId_registryId: {
            campaignId: campaign.id,
            registryId: registry.id,
          },
        },
        update: {
          status: registry.coverageStatus,
          reason: registry.coverageReason,
          evaluatedAt: new Date(),
          expiresAt: registry.nextReviewAt,
        },
        create: {
          campaignId: campaign.id,
          registryId: registry.id,
          status: registry.coverageStatus,
          reason: registry.coverageReason,
          expiresAt: registry.nextReviewAt,
        },
      });
      covered += 1;
    }
  }
  return { campaigns: campaigns.length, covered, unresolved };
}
export async function approveCampaign(input: {
  campaignId: string;
  actor: string;
}) {
  if (!input.actor.trim()) throw new Error("Owner identity is required.");
  return getPrisma().$transaction(async (tx) => {
    const campaign = await tx.acquisitionCampaign.findUnique({
      where: { id: input.campaignId },
      include: { boundaries: { orderBy: { version: "desc" }, take: 1 } },
    });
    if (
      !campaign ||
      campaign.status !== "DRAFT" ||
      campaign.boundaries.length !== 1
    )
      throw new Error(
        "Only a draft campaign with one current boundary can be approved.",
      );
    return tx.acquisitionCampaign.update({
      where: { id: input.campaignId },
      data: {
        status: "APPROVED",
        ownerApprovedAt: new Date(),
        ownerApprovedBy: input.actor,
        outboundEnabled: false,
      },
    });
  });
}
export async function activateCampaign(input: {
  campaignId: string;
  actor: string;
  now?: Date;
}) {
  await synchronizeCampaignCountyCoverage();
  const now = input.now ?? new Date();
  const db = getPrisma();
  const campaign = await db.acquisitionCampaign.findUnique({
    where: { id: input.campaignId },
    include: {
      boundaries: { orderBy: { version: "desc" }, take: 1 },
      countyCoverage: true,
    },
  });
  if (!campaign) throw new Error("Campaign not found.");
  const boundary = campaign.boundaries[0];
  const required = boundary?.allowedCounties.length ?? 0;
  const live = campaign.countyCoverage.filter(
    (item) =>
      ["AUTOMATED", "MANUAL_ONLY"].includes(item.status) &&
      (!item.expiresAt || item.expiresAt > now),
  ).length;
  const decision = evaluateCampaignLifecycle({
    status: campaign.status,
    ownerApprovedAt: campaign.ownerApprovedAt,
    startsAt: campaign.startsAt,
    endsAt: campaign.endsAt,
    boundaryCount: campaign.boundaries.length,
    requiredCountyCount: required,
    coveredCountyCount: live,
    now,
  });
  if (!decision.allowed)
    throw new Error(
      `Campaign activation blocked: ${decision.blockers.join(", ")}`,
    );
  return db.acquisitionCampaign.update({
    where: { id: campaign.id },
    data: { status: "ACTIVE", outboundEnabled: false },
  });
}
export async function pauseCampaign(input: {
  campaignId: string;
  actor: string;
}) {
  if (!input.actor.trim()) throw new Error("Owner identity is required.");
  const campaign = await getPrisma().acquisitionCampaign.findUnique({
    where: { id: input.campaignId },
  });
  if (!campaign || campaign.status !== "ACTIVE")
    throw new Error("Only an active campaign can be paused.");
  return getPrisma().acquisitionCampaign.update({
    where: { id: input.campaignId },
    data: { status: "PAUSED", outboundEnabled: false },
  });
}
export async function assignCampaignOpportunity(input: {
  campaignId: string;
  funnelId: string;
  reason: string;
}) {
  if (input.reason.trim().length < 10)
    throw new Error("Assignment reason is required.");
  const db = getPrisma();
  return db.$transaction(
    async (tx) => {
      const [campaign, funnel, costs] = await Promise.all([
        tx.acquisitionCampaign.findUnique({
          where: { id: input.campaignId },
          include: { boundaries: { orderBy: { version: "desc" }, take: 1 } },
        }),
        tx.acquisitionFunnel.findUnique({
          where: { id: input.funnelId },
          include: {
            property: {
              include: {
                countyRegistry: true,
                researchFindings: {
                  where: { status: "VERIFIED" },
                  orderBy: { observedAt: "desc" },
                  take: 1,
                },
              },
            },
            transaction: {
              include: {
                financialProjections: { orderBy: { version: "desc" }, take: 1 },
              },
            },
          },
        }),
        tx.campaignCostEntry.findMany({
          where: { campaignId: input.campaignId },
        }),
      ]);
      if (
        !campaign ||
        campaign.status !== "ACTIVE" ||
        !campaign.ownerApprovedAt
      )
        throw new Error("Campaign must be active and owner approved.");
      if (!funnel || !campaign.boundaries[0])
        throw new Error("Funnel and current campaign boundary are required.");
      if (funnel.transaction && funnel.transaction.controlStatus !== "ACTIVE")
        throw new Error(
          `Transaction is ${funnel.transaction.controlStatus.toLowerCase()}.`,
        );
      const projection = funnel.transaction?.financialProjections[0];
      const researchCost = costs
        .filter((c) => ["RESEARCH", "DATA"].includes(c.type))
        .reduce((s, c) => s + c.amountCents, BigInt(0));
      const outreachCost = costs
        .filter((c) => ["OUTREACH", "COMMUNICATION"].includes(c.type))
        .reduce((s, c) => s + c.amountCents, BigInt(0));
      const decision = evaluateCampaignOpportunity({
        boundary: campaign.boundaries[0],
        property: {
          state: funnel.property.state,
          county: funnel.property.county,
          city: funnel.property.city,
          zipCode: funnel.property.zipCode,
          neighborhood: funnel.property.neighborhood,
          propertyType: funnel.property.propertyType ?? "",
        },
        projectedProfitCents: projection?.feeBaseCents,
        earnestMoneyCents: projection?.earnestMoneyAtRiskCents,
        evidenceObservedAt: funnel.property.researchFindings[0]?.observedAt,
        countyCoverageStatus: funnel.property.countyRegistry?.coverageStatus,
        researchCostCents: researchCost,
        outreachCostCents: outreachCost,
        now: new Date(),
      });
      if (!decision.eligible)
        throw new Error(
          `Campaign opportunity blocked: ${decision.blockers.join(", ")}`,
        );
      return tx.campaignOpportunity.upsert({
        where: {
          campaignId_funnelId: {
            campaignId: input.campaignId,
            funnelId: input.funnelId,
          },
        },
        update: { status: "INCLUDED", reason: input.reason },
        create: { ...input, status: "INCLUDED" },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
export async function assignCampaignAgent(input: {
  campaignId: string;
  agentId: string;
  responsibility: string;
  actor: string;
}) {
  if (!input.responsibility.trim())
    throw new Error("Agent responsibility is required.");
  const db = getPrisma();
  const campaign = await db.acquisitionCampaign.findUnique({
    where: { id: input.campaignId },
  });
  if (!campaign || campaign.status !== "ACTIVE" || !campaign.ownerApprovedAt)
    throw new Error(
      "Agents can only be assigned to an active owner-approved campaign.",
    );
  return db.campaignAgentAssignment.upsert({
    where: {
      campaignId_agentId: {
        campaignId: input.campaignId,
        agentId: input.agentId,
      },
    },
    update: {
      active: true,
      removedAt: null,
      responsibility: input.responsibility,
      assignedBy: input.actor,
    },
    create: {
      campaignId: input.campaignId,
      agentId: input.agentId,
      responsibility: input.responsibility,
      assignedBy: input.actor,
    },
  });
}
export async function recordCampaignCost(input: {
  campaignId: string;
  funnelId?: string;
  type: CampaignCostType;
  amountCents: bigint;
  incurredAt: Date;
  sourceUrl: string;
  artifactHash?: string;
  description: string;
  actor: string;
}) {
  if (input.amountCents < BigInt(0) || input.incurredAt > new Date())
    throw new Error("Campaign cost is invalid.");
  if (input.artifactHash && !/^[a-f0-9]{64}$/i.test(input.artifactHash))
    throw new Error("Artifact hash must be SHA-256.");
  const { actor, ...data } = input;
  return getPrisma().campaignCostEntry.create({
    data: { ...data, sourceUrl: https(data.sourceUrl), recordedBy: actor },
  });
}
export async function createCampaignGoalVersion(input: {
  campaignId: string;
  discoveredTarget?: number;
  researchedTarget?: number;
  sellerContactTarget?: number;
  offerTarget?: number;
  contractTarget?: number;
  closeTarget?: number;
  realizedProfitTargetCents?: bigint;
  effectiveAt: Date;
  expiresAt?: Date;
  actor: string;
}) {
  const values = [
    input.discoveredTarget,
    input.researchedTarget,
    input.sellerContactTarget,
    input.offerTarget,
    input.contractTarget,
    input.closeTarget,
  ];
  if (
    values.some(
      (value) => value != null && (!Number.isInteger(value) || value < 0),
    )
  )
    throw new Error("Campaign goals must be nonnegative whole numbers.");
  return getPrisma().$transaction(
    async (tx) => {
      const latest = await tx.campaignGoalVersion.findFirst({
        where: { campaignId: input.campaignId },
        orderBy: { version: "desc" },
      });
      const { actor, ...data } = input;
      return tx.campaignGoalVersion.create({
        data: {
          ...data,
          version: (latest?.version ?? 0) + 1,
          createdBy: actor,
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
export async function readCampaignWorkspace() {
  const db = getPrisma();
  return Promise.all([
    db.acquisitionCampaign.findMany({
      include: {
        boundaries: { orderBy: { version: "desc" }, take: 1 },
        countyCoverage: true,
        opportunities: {
          include: {
            funnel: {
              include: {
                property: true,
                transaction: {
                  include: {
                    settlementReviews: {
                      orderBy: { version: "desc" },
                      take: 1,
                    },
                  },
                },
              },
            },
          },
        },
        agentAssignments: { include: { agent: true } },
        costs: true,
        goals: { orderBy: { version: "desc" }, take: 1 },
      },
      orderBy: { updatedAt: "desc" },
    }),
    db.acquisitionFunnel.findMany({
      include: { property: true },
      orderBy: { updatedAt: "desc" },
    }),
    db.agent.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
    }),
  ]);
}
