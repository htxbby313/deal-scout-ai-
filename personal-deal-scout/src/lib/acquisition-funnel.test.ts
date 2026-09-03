import { describe, expect, it } from "vitest";
import {
  evaluateBuyerCoverage,
  evaluateBuyerDemand,
  evaluateCampaignActivation,
  evaluateStageTransition,
} from "@/lib/acquisition-funnel";

const now = new Date("2026-08-19T12:00:00Z");

describe("acquisition funnel policy", () => {
  it("requires sequential stages, live gates, and active transaction control", () => {
    expect(
      evaluateStageTransition({
        currentStage: "UNDERWRITING_READY",
        nextStage: "OFFER_READY",
        gates: [
          {
            type: "COMPLIANCE",
            version: 1,
            status: "SATISFIED",
            expiresAt: "2026-09-01",
          },
        ],
        transactionControlStatus: "ACTIVE",
        now,
      }).allowed,
    ).toBe(true);
    const stopped = evaluateStageTransition({
      currentStage: "UNDERWRITING_READY",
      nextStage: "OFFER_READY",
      gates: [
        {
          type: "COMPLIANCE",
          version: 1,
          status: "SATISFIED",
          expiresAt: "2026-08-01",
        },
      ],
      transactionControlStatus: "STOPPED",
      now,
    });
    expect(stopped.allowed).toBe(false);
    expect(stopped.blockers).toEqual([
      "transaction_stopped",
      "gate_compliance_expired",
    ]);
  });

  it("does not let funnel CONTRACTED outrun DealTransaction status", () => {
    const blocked = evaluateStageTransition({
      currentStage: "OFFER_READY",
      nextStage: "CONTRACTED",
      gates: [
        {
          type: "CONTRACT",
          version: 1,
          status: "SATISFIED",
          expiresAt: "2026-09-01",
        },
      ],
      transactionControlStatus: "ACTIVE",
      transactionStatus: "DRAFT",
      now,
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.blockers).toContain("transaction_status_not_contracted");
    expect(
      evaluateStageTransition({
        currentStage: "OFFER_READY",
        nextStage: "CONTRACTED",
        gates: [
          {
            type: "CONTRACT",
            version: 1,
            status: "SATISFIED",
            expiresAt: "2026-09-01",
          },
        ],
        transactionControlStatus: "ACTIVE",
        transactionStatus: "UNDER_CONTRACT",
        now,
      }).allowed,
    ).toBe(true);
  });

  it("explains demand, capacity, and reliability matching from versioned evidence", () => {
    const result = evaluateBuyerDemand({
      demand: {
        id: "d1",
        developerId: "buyer-1",
        status: "VERIFIED",
        states: ["TX"],
        counties: [],
        zipCodes: [],
        assetTypes: ["LAND"],
        minPurchasePriceCents: BigInt(5_000_000),
        maxPurchasePriceCents: BigInt(30_000_000),
        maxAssignmentFeeCents: BigInt(2_500_000),
        verifiedAt: "2026-08-01",
        expiresAt: "2026-10-01",
      },
      property: {
        state: "TX",
        county: "Hudspeth",
        zipCode: "79837",
        assetType: "LAND",
        purchasePriceCents: BigInt(12_500_000),
        acres: 20,
        assignmentFeeCents: BigInt(2_000_000),
      },
      proofOfFunds: {
        status: "VERIFIED",
        amountCents: BigInt(20_000_000),
        expiresAt: "2026-09-01",
      },
      reliability: {
        status: "VERIFIED",
        completedClosings: 4,
        failedClosings: 0,
        expiresAt: "2026-09-01",
      },
      now,
    });
    expect(result).toMatchObject({ eligible: true, score: 100 });
    expect(result.reasons).toContain("capacity_verified");
  });

  it("requires distinct confirmed primary and backup buyers", () => {
    const oneBuyer = evaluateBuyerCoverage(
      [
        {
          developerId: "a",
          role: "PRIMARY",
          status: "CONFIRMED",
          expiresAt: "2026-09-01",
        },
        {
          developerId: "a",
          role: "BACKUP",
          status: "CONFIRMED",
          expiresAt: "2026-09-01",
        },
      ],
      now,
    );
    expect(oneBuyer.covered).toBe(false);
    const covered = evaluateBuyerCoverage(
      [
        {
          developerId: "a",
          role: "PRIMARY",
          status: "CONFIRMED",
          expiresAt: "2026-09-01",
        },
        {
          developerId: "b",
          role: "BACKUP",
          status: "CONFIRMED",
          expiresAt: "2026-09-01",
        },
      ],
      now,
    );
    expect(covered.covered).toBe(true);
  });

  it("keeps campaigns fail-closed behind owner, transaction, and boundary controls", () => {
    const base = {
      campaignStatus: "APPROVED",
      transactionControlStatus: "ACTIVE" as const,
      ownerApprovedAt: now,
      outboundEnabled: true,
      jurisdictionState: "TX",
      channel: "email",
      now,
      boundary: {
        allowedStates: ["TX"],
        allowedChannels: ["email"],
        doNotContactEnforced: true,
        consentRequired: true,
        maxRecipientsPerDay: 10,
        effectiveAt: "2026-08-01",
        expiresAt: "2026-09-01",
      },
    };
    expect(evaluateCampaignActivation(base).allowed).toBe(true);
    const stopped = evaluateCampaignActivation({
      ...base,
      transactionControlStatus: "STOPPED",
    });
    expect(stopped).toMatchObject({
      allowed: false,
      blockers: ["transaction_stopped"],
    });
    expect(
      evaluateCampaignActivation({
        ...base,
        boundary: { ...base.boundary, consentRequired: false },
      }).blockers,
    ).toContain("consent_not_required");
  });
});
