import "server-only";

import { createHash } from "node:crypto";
import { Prisma, type EngagementChannel } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";
import {
  attemptProviderSend,
  generateDeveloperPricingRequest,
} from "@/lib/database";
import {
  evaluateAutonomousOutreach,
  messageFitsAuthorization,
  selectOutreachRecipient,
} from "@/lib/autonomous-outreach-policy";

const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const recipientDigest = (value: string) => {
  const pepper = process.env.CONTACT_HASH_PEPPER;
  if (!pepper)
    throw new Error(
      "CONTACT_HASH_PEPPER is required before autonomous outreach can be queued.",
    );
  return digest(`${pepper}:${value.trim().toLocaleLowerCase()}`);
};
const startOfUtcDay = (now: Date) =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

export async function activateBoundedOutreach(input: {
  campaignId: string;
  audience: "SELLER" | "BUYER" | "BOTH";
  allowedChannels: EngagementChannel[];
  maximumMessagesPerDay: number;
  maximumMessagesPerRecipient: number;
  maximumFollowUpsPerRecipient: number;
  sellerOfferCeilingCents?: bigint;
  requiredDisclosure?: string;
  prohibitedClaims: string[];
  escalationTriggers: string[];
  startsAt: Date;
  expiresAt: Date;
  actor: string;
}) {
  if (!input.actor.trim()) throw new Error("Owner identity is required.");
  if (
    !input.allowedChannels.length ||
    input.allowedChannels.some((channel) => !["EMAIL", "SMS"].includes(channel))
  )
    throw new Error(
      "Autonomous delivery currently supports reviewed email and SMS channels only.",
    );
  if (input.startsAt >= input.expiresAt || input.expiresAt <= new Date())
    throw new Error(
      "The authorization requires a current start and future expiration.",
    );
  for (const value of [
    input.maximumMessagesPerDay,
    input.maximumMessagesPerRecipient,
    input.maximumFollowUpsPerRecipient,
  ])
    if (!Number.isInteger(value) || value < 0)
      throw new Error("Outreach limits must be nonnegative whole numbers.");
  if (
    input.maximumMessagesPerDay > 100 ||
    input.maximumMessagesPerRecipient > 5 ||
    input.maximumFollowUpsPerRecipient > 3
  )
    throw new Error(
      "Requested outreach limits exceed the hard safety maximum.",
    );

  const db = getPrisma();
  return db.$transaction(
    async (tx) => {
      const campaign = await tx.acquisitionCampaign.findUnique({
        where: { id: input.campaignId },
        include: {
          opportunities: {
            where: { status: "INCLUDED" },
            include: {
              funnel: {
                include: {
                  property: {
                    include: { matches: { include: { developer: true } } },
                  },
                  transaction: true,
                },
              },
            },
          },
        },
      });
      if (
        !campaign ||
        campaign.status !== "ACTIVE" ||
        !campaign.ownerApprovedAt
      )
        throw new Error(
          "Only an active owner-approved campaign can receive outreach authority.",
        );
      const eligible = campaign.opportunities.filter(
        (item) => item.funnel.transaction?.controlStatus === "ACTIVE",
      );
      const approvedPropertyIds = [
        ...new Set(eligible.map((item) => item.funnel.propertyId)),
      ].sort();
      const approvedDeveloperIds = [
        ...new Set(
          eligible
            .flatMap((item) => item.funnel.property.matches)
            .filter(
              (match) =>
                match.developer.active && match.developer.communicationsEnabled,
            )
            .map((match) => match.developerId),
        ),
      ].sort();
      if (!approvedPropertyIds.length)
        throw new Error("No included opportunity has an active transaction.");
      if (
        (input.audience === "BUYER" || input.audience === "BOTH") &&
        !approvedDeveloperIds.length
      )
        throw new Error(
          "No approved, communications-enabled buyer match is available.",
        );
      const snapshot = {
        campaignId: campaign.id,
        audience: input.audience,
        allowedChannels: [...input.allowedChannels].sort(),
        approvedPropertyIds,
        approvedDeveloperIds,
        maximumMessagesPerDay: input.maximumMessagesPerDay,
        maximumMessagesPerRecipient: input.maximumMessagesPerRecipient,
        maximumFollowUpsPerRecipient: input.maximumFollowUpsPerRecipient,
        sellerOfferCeilingCents:
          input.sellerOfferCeilingCents?.toString() ?? null,
        requiredDisclosure: input.requiredDisclosure?.trim() || null,
        prohibitedClaims: input.prohibitedClaims
          .map((item) => item.trim())
          .filter(Boolean)
          .sort(),
        escalationTriggers: input.escalationTriggers
          .map((item) => item.trim())
          .filter(Boolean)
          .sort(),
        startsAt: input.startsAt.toISOString(),
        expiresAt: input.expiresAt.toISOString(),
      };
      await tx.outreachAuthorization.updateMany({
        where: { campaignId: campaign.id, status: "ACTIVE" },
        data: { status: "PAUSED", pausedAt: new Date() },
      });
      const authorization = await tx.outreachAuthorization.create({
        data: {
          ...snapshot,
          sellerOfferCeilingCents: input.sellerOfferCeilingCents,
          startsAt: input.startsAt,
          expiresAt: input.expiresAt,
          status: "ACTIVE",
          ownerApprovedAt: new Date(),
          ownerApprovedBy: input.actor,
          activatedAt: new Date(),
          approvalFingerprint: digest(JSON.stringify(snapshot)),
        },
      });
      await tx.acquisitionCampaign.update({
        where: { id: campaign.id },
        data: { outboundEnabled: true },
      });
      await tx.auditLog.create({
        data: {
          type: "outreach.authorization.activated",
          summary: `Activated bounded ${input.audience.toLowerCase()} outreach for ${campaign.name}.`,
          details: {
            authorizationId: authorization.id,
            approvalFingerprint: authorization.approvalFingerprint,
            approvedPropertyIds,
            approvedDeveloperIds,
            limits: {
              daily: input.maximumMessagesPerDay,
              perRecipient: input.maximumMessagesPerRecipient,
              followUps: input.maximumFollowUpsPerRecipient,
            },
          },
        },
      });
      return authorization;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function pauseBoundedOutreach(input: {
  authorizationId: string;
  actor: string;
}) {
  if (!input.actor.trim()) throw new Error("Owner identity is required.");
  const db = getPrisma();
  return db.$transaction(async (tx) => {
    const authorization = await tx.outreachAuthorization.findUnique({
      where: { id: input.authorizationId },
    });
    if (!authorization || authorization.status !== "ACTIVE")
      throw new Error("Only active outreach can be paused.");
    const paused = await tx.outreachAuthorization.update({
      where: { id: authorization.id },
      data: { status: "PAUSED", pausedAt: new Date() },
    });
    const activeCount = await tx.outreachAuthorization.count({
      where: {
        campaignId: authorization.campaignId,
        status: "ACTIVE",
        id: { not: authorization.id },
      },
    });
    if (!activeCount)
      await tx.acquisitionCampaign.update({
        where: { id: authorization.campaignId },
        data: { outboundEnabled: false },
      });
    await tx.auditLog.create({
      data: {
        type: "outreach.authorization.paused",
        summary: "Owner paused bounded autonomous outreach.",
        details: { authorizationId: authorization.id, actor: input.actor },
      },
    });
    return paused;
  });
}

export async function queueAuthorizedCampaignMessages(
  authorizationId: string,
  now = new Date(),
) {
  const db = getPrisma();
  const authorization = await db.outreachAuthorization.findUnique({
    where: { id: authorizationId },
  });
  if (!authorization || authorization.status !== "ACTIVE")
    return { queued: 0, blocked: 0 };
  if (["SELLER", "BOTH"].includes(authorization.audience)) {
    const sellerEngagements = await db.sellerEngagement.findMany({
      where: {
        transaction: {
          propertyId: { in: authorization.approvedPropertyIds },
          controlStatus: "ACTIVE",
        },
        status: { in: ["READY_FOR_OWNER_REVIEW", "OWNER_APPROVED"] },
      },
      include: {
        transaction: {
          include: { property: { include: { leads: { take: 1 } } } },
        },
      },
    });
    for (const engagement of sellerEngagements) {
      const property = engagement.transaction.property;
      const subject = `Seller conversation: ${property.address}`;
      const exists = await db.messageApproval.findFirst({
        where: {
          propertyId: property.id,
          subject,
          status: { in: ["PENDING", "CAMPAIGN_APPROVED", "APPROVED", "SENT"] },
        },
      });
      if (!exists)
        await db.messageApproval.create({
          data: {
            leadId: property.leads[0]?.id,
            propertyId: property.id,
            channel: engagement.channel,
            recipientLabel:
              engagement.recipientLabel ||
              property.contactName ||
              property.ownerName,
            subject,
            body: engagement.purpose,
            provider: "disabled",
          },
        });
    }
  }
  if (["BUYER", "BOTH"].includes(authorization.audience)) {
    const matches = await db.developerMatch.findMany({
      where: {
        propertyId: { in: authorization.approvedPropertyIds },
        developerId: { in: authorization.approvedDeveloperIds },
      },
      select: { propertyId: true, developerId: true },
    });
    for (const match of matches) {
      try {
        await generateDeveloperPricingRequest(
          match.propertyId,
          match.developerId,
        );
      } catch {
        /* Property-presentation policy remains a hard gate; ineligible drafts are not queued. */
      }
    }
  }
  const approvals = await db.messageApproval.findMany({
    where: {
      status: { in: ["PENDING", "SENT_BLOCKED"] },
      channel: { in: authorization.allowedChannels },
      OR: [
        { propertyId: { in: authorization.approvedPropertyIds } },
        { developerId: { in: authorization.approvedDeveloperIds } },
      ],
    },
    include: { property: true, developer: true },
    orderBy: { createdAt: "asc" },
  });
  let queued = 0;
  let blocked = 0;
  for (const approval of approvals) {
    const recipient = selectOutreachRecipient(approval);
    if (!recipient) {
      blocked += 1;
      continue;
    }
    const disclosure = authorization.requiredDisclosure?.trim();
    const body =
      disclosure &&
      !approval.body
        .toLocaleLowerCase()
        .includes(disclosure.toLocaleLowerCase())
        ? `${approval.body.trim()}\n\n${disclosure}`
        : approval.body;
    const contentHash = digest(
      `${approval.channel}\n${recipient}\n${approval.subject ?? ""}\n${body}`,
    );
    await db.$transaction(async (tx) => {
      await tx.messageApproval.update({
        where: { id: approval.id },
        data: { body, status: "CAMPAIGN_APPROVED", blockerCodes: [] },
      });
      await tx.autonomousOutreachDelivery.upsert({
        where: {
          authorizationId_messageApprovalId: {
            authorizationId,
            messageApprovalId: approval.id,
          },
        },
        update: {},
        create: {
          authorizationId,
          messageApprovalId: approval.id,
          recipientHash: recipientDigest(recipient),
          contentHash,
          channel: approval.channel as EngagementChannel,
          scheduledAt: now,
        },
      });
    });
    queued += 1;
  }
  return { queued, blocked };
}

export async function runAuthorizedOutreachBatch(limit = 10, now = new Date()) {
  const db = getPrisma();
  const deliveries = await db.autonomousOutreachDelivery.findMany({
    where: {
      status: { in: ["QUEUED", "WAITING"] },
      scheduledAt: { lte: now },
      authorization: {
        status: "ACTIVE",
        startsAt: { lte: now },
        expiresAt: { gt: now },
        campaign: { status: "ACTIVE", outboundEnabled: true },
      },
    },
    include: {
      authorization: true,
      messageApproval: {
        include: {
          property: {
            include: {
              transactions: {
                orderBy: { createdAt: "desc" },
                take: 1,
                include: {
                  sellerEngagements: {
                    include: {
                      consents: { orderBy: { capturedAt: "desc" }, take: 1 },
                    },
                  },
                },
              },
            },
          },
          developer: {
            include: { buyerPermissions: { orderBy: { capturedAt: "desc" } } },
          },
        },
      },
    },
    orderBy: { scheduledAt: "asc" },
    take: Math.max(1, Math.min(limit, 100)),
  });
  const results: Array<{ id: string; status: string; blockers?: string[] }> =
    [];
  for (const delivery of deliveries) {
    const claimed = await db.autonomousOutreachDelivery.updateMany({
      where: {
        id: delivery.id,
        status: { in: ["QUEUED", "WAITING"] },
      },
      data: {
        status: "IN_PROGRESS",
        attemptedAt: now,
        attemptCount: { increment: 1 },
      },
    });
    if (!claimed.count) continue;
    const approval = delivery.messageApproval;
    const authorization = delivery.authorization;
    const targetAudience = approval.developerId
      ? ("BUYER" as const)
      : ("SELLER" as const);
    const targetId = approval.developerId ?? approval.propertyId;
    const recipient = selectOutreachRecipient(approval);
    const sentToday = await db.autonomousOutreachDelivery.count({
      where: {
        authorizationId: authorization.id,
        status: "SENT",
        completedAt: { gte: startOfUtcDay(now) },
      },
    });
    const sentToRecipient = await db.autonomousOutreachDelivery.count({
      where: {
        authorizationId: authorization.id,
        recipientHash: delivery.recipientHash,
        status: "SENT",
      },
    });
    const isFollowUp = sentToRecipient > 0;
    const suppressed = await db.contactSuppression.findFirst({
      where: {
        recipientHash: delivery.recipientHash,
        channel: delivery.channel,
        effectiveAt: { lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    });
    const provider = await db.providerIntegrationReadiness.findFirst({
      where: { channel: delivery.channel, status: "READY", ownerEnabled: true },
    });
    const sellerConsent = approval.property?.transactions[0]?.sellerEngagements
      .flatMap((engagement) => engagement.consents)
      .find((consent) => consent.channel === delivery.channel);
    const buyerPermission = approval.developer?.buyerPermissions.find(
      (permission) => permission.channel === delivery.channel,
    );
    const permissionGranted =
      targetAudience === "SELLER"
        ? sellerConsent?.status === "GRANTED" &&
          (!sellerConsent.expiresAt || sellerConsent.expiresAt > now)
        : approval.developer?.communicationsEnabled === true &&
          buyerPermission?.status === "GRANTED" &&
          (!buyerPermission.expiresAt || buyerPermission.expiresAt > now);
    const latestTransaction = approval.property?.transactions[0];
    const decision = evaluateAutonomousOutreach({
      authorizationStatus: authorization.status,
      startsAt: authorization.startsAt,
      expiresAt: authorization.expiresAt,
      now,
      channel: delivery.channel,
      allowedChannels: authorization.allowedChannels,
      audience: authorization.audience,
      targetAudience,
      targetIdApproved: Boolean(
        targetId &&
        (targetAudience === "SELLER"
          ? authorization.approvedPropertyIds
          : authorization.approvedDeveloperIds
        ).includes(targetId) &&
        (targetAudience === "SELLER" ||
          Boolean(
            approval.propertyId &&
            authorization.approvedPropertyIds.includes(approval.propertyId),
          )),
      ),
      contentCompliant:
        Boolean(recipient) &&
        delivery.contentHash ===
          digest(
            `${approval.channel}\n${recipient}\n${approval.subject ?? ""}\n${approval.body}`,
          ) &&
        messageFitsAuthorization({
          body: approval.body,
          requiredDisclosure: authorization.requiredDisclosure,
          prohibitedClaims: authorization.prohibitedClaims,
          sellerOfferCeilingCents:
            targetAudience === "SELLER"
              ? authorization.sellerOfferCeilingCents
              : null,
        }),
      recipientSuppressed: Boolean(suppressed),
      permissionGranted,
      providerReady: Boolean(provider),
      sentToday,
      sentToRecipient,
      followUpsToRecipient: Math.max(0, sentToRecipient - 1),
      maximumMessagesPerDay: authorization.maximumMessagesPerDay,
      maximumMessagesPerRecipient: authorization.maximumMessagesPerRecipient,
      maximumFollowUpsPerRecipient: authorization.maximumFollowUpsPerRecipient,
      isFollowUp,
      transactionActive: latestTransaction?.controlStatus === "ACTIVE",
    });
    if (!decision.allowed) {
      const hardBlockers = new Set([
        "authorization_not_active",
        "authorization_expired",
        "channel_not_authorized",
        "audience_not_authorized",
        "target_not_in_approved_snapshot",
        "message_outside_approved_boundaries",
        "recipient_suppressed",
      ]);
      const status = decision.blockers.some((blocker) =>
        hardBlockers.has(blocker),
      )
        ? "BLOCKED"
        : "WAITING";
      await db.autonomousOutreachDelivery.update({
        where: { id: delivery.id },
        data: {
          status,
          blockerCodes: decision.blockers,
          attemptedAt: now,
          scheduledAt:
            status === "WAITING"
              ? new Date(now.getTime() + 60 * 60_000)
              : delivery.scheduledAt,
        },
      });
      results.push({
        id: delivery.id,
        status,
        blockers: decision.blockers,
      });
      continue;
    }
    await db.messageApproval.update({
      where: { id: approval.id },
      data: { status: "APPROVED" },
    });
    try {
      await attemptProviderSend(approval.id);
    } catch {
      await db.autonomousOutreachDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "WAITING",
          blockerCodes: ["provider_send_failed"],
          scheduledAt: new Date(now.getTime() + 60 * 60_000),
        },
      });
      results.push({
        id: delivery.id,
        status: "WAITING",
        blockers: ["provider_send_failed"],
      });
      continue;
    }
    const completed = await db.messageApproval.findUniqueOrThrow({
      where: { id: approval.id },
    });
    const status = completed.status === "SENT" ? "SENT" : "FAILED";
    await db.autonomousOutreachDelivery.update({
      where: { id: delivery.id },
      data: {
        status,
        provider: completed.provider,
        blockerCodes: completed.blockerCodes,
        attemptedAt: now,
        completedAt: status === "SENT" ? now : null,
      },
    });
    results.push({ id: delivery.id, status, blockers: completed.blockerCodes });
  }
  return { processed: results.length, results };
}

export async function readOutreachAuthorizations() {
  return getPrisma().outreachAuthorization.findMany({
    include: {
      campaign: true,
      deliveries: { orderBy: { createdAt: "desc" }, take: 20 },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function runAutonomousOutreachCycle(now = new Date()) {
  const authorizations = await getPrisma().outreachAuthorization.findMany({
    where: {
      status: "ACTIVE",
      startsAt: { lte: now },
      expiresAt: { gt: now },
      campaign: { status: "ACTIVE", outboundEnabled: true },
    },
    select: { id: true },
  });
  const queued = [];
  for (const authorization of authorizations)
    queued.push({
      authorizationId: authorization.id,
      ...(await queueAuthorizedCampaignMessages(authorization.id, now)),
    });
  const delivery = await runAuthorizedOutreachBatch(25, now);
  return { authorizations: authorizations.length, queued, delivery };
}
