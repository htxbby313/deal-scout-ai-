import { beforeEach, describe, expect, it, vi } from "vitest";
import { EngagementChannel, SellerDispositionReason } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  requireOwner: vi.fn(async () => undefined),
  createEngagement: vi.fn(async () => ({})),
  recordConversation: vi.fn(async () => ({})),
  recordDisposition: vi.fn(async () => ({})),
  recordFacts: vi.fn(async () => ({})),
  scheduleFollowUp: vi.fn(async () => ({})),
  revalidatePath: vi.fn(),
  createTransaction: vi.fn(async () => ({ id: "tx-created" })),
  sellerEngagementFindUnique: vi.fn(),
  dealTransactionFindUnique: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireOwner: mocks.requireOwner }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/seller-engagement", () => ({
  createSellerEngagementDraft: mocks.createEngagement,
}));
vi.mock("@/lib/seller-crm", () => ({
  recordSellerConversation: mocks.recordConversation,
  recordSellerDisposition: mocks.recordDisposition,
  recordSellerFacts: mocks.recordFacts,
  scheduleSellerFollowUp: mocks.scheduleFollowUp,
}));
vi.mock("@/lib/transaction-control", () => ({
  createControlledTransaction: mocks.createTransaction,
}));
vi.mock("@/lib/prisma", () => ({
  getPrisma: () => ({
    sellerEngagement: { findUnique: mocks.sellerEngagementFindUnique },
    dealTransaction: { findUnique: mocks.dealTransactionFindUnique },
  }),
}));

import {
  createSellerEngagementAction,
  recordSellerConversationAction,
  recordSellerDispositionAction,
  recordSellerFactsAction,
  scheduleSellerFollowUpAction,
  startSellerThreadOnDealAction,
} from "@/app/seller-crm-actions";

const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};

describe("seller CRM action validation", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(Object.values(EngagementChannel))(
    "accepts persisted engagement channel %s",
    async (channel) => {
      await createSellerEngagementAction(
        form({
          transactionId: "tx",
          channel,
          recipient: "person@example.com",
          purpose: "Discuss the property.",
        }),
      );
      expect(mocks.createEngagement).toHaveBeenCalledWith(
        expect.objectContaining({ channel }),
      );
    },
  );

  it.each(Object.values(EngagementChannel))(
    "accepts persisted follow-up channel %s",
    async (channel) => {
      await scheduleSellerFollowUpAction(
        form({
          engagementId: "eng",
          channel,
          dueAt: "2026-08-22T10:00",
          reason: "Requested follow-up",
        }),
      );
      expect(mocks.scheduleFollowUp).toHaveBeenCalledWith(
        expect.objectContaining({ channel }),
      );
    },
  );

  it.each(Object.values(SellerDispositionReason))(
    "accepts persisted disposition reason %s",
    async (reason) => {
      await recordSellerDispositionAction(
        form({
          engagementId: "eng",
          reason,
          ...(reason === SellerDispositionReason.OTHER
            ? { explanation: "Other sourced reason" }
            : {}),
        }),
      );
      expect(mocks.recordDisposition).toHaveBeenCalledWith(
        expect.objectContaining({ reason }),
      );
    },
  );

  it("rejects tampered enums before a persistence call", async () => {
    await expect(
      createSellerEngagementAction(
        form({
          transactionId: "tx",
          channel: "Email",
          recipient: "person@example.com",
          purpose: "Discuss the property.",
        }),
      ),
    ).rejects.toThrow("Channel is invalid");
    expect(mocks.createEngagement).not.toHaveBeenCalled();
    await expect(
      recordSellerDispositionAction(
        form({ engagementId: "eng", reason: "Not real" }),
      ),
    ).rejects.toThrow("Disposition reason is invalid");
    expect(mocks.recordDisposition).not.toHaveBeenCalled();
    await expect(
      recordSellerFactsAction(
        form({
          engagementId: "eng",
          conversationId: "conversation",
          authorityStatus: "Trusted",
          representationStatus: "UNKNOWN",
          sellerStatedAt: "2026-08-20T10:00",
        }),
      ),
    ).rejects.toThrow("Authority status is invalid");
    expect(mocks.recordFacts).not.toHaveBeenCalled();
  });

  it("persists objections and questions as separate trimmed entries", async () => {
    await recordSellerConversationAction(
      form({
        engagementId: "eng",
        occurredAt: "2026-08-20T10:00",
        sourceType: "Call",
        summary: "Seller discussed the property.",
        objections: "Price is low.\n\nNeed more time.",
        questions: "When can you close?\nWho pays title?",
      }),
    );
    expect(mocks.recordConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        objections: ["Price is low.", "Need more time."],
        questions: ["When can you close?", "Who pays title?"],
      }),
    );
  });

  it("passes valid seller facts to the scoped persistence service", async () => {
    await recordSellerFactsAction(
      form({
        engagementId: "eng",
        conversationId: "conversation",
        priorities: "Speed, Certainty",
        timeline: "30 days",
        propertyCondition: "As-is",
        authorityStatus: "DOCUMENTED",
        authoritySourceUrl: "https://county.example/record",
        representationStatus: "UNREPRESENTED",
        preferredChannel: "PHONE",
        sellerStatedAt: "2026-08-20T10:00",
      }),
    );
    expect(mocks.recordFacts).toHaveBeenCalledWith(
      expect.objectContaining({
        engagementId: "eng",
        conversationId: "conversation",
        priorities: ["Speed", "Certainty"],
        authorityStatus: "DOCUMENTED",
        representationStatus: "UNREPRESENTED",
        preferredChannel: "PHONE",
      }),
    );
  });

  it("revalidates Deal Box when propertyId is posted with a conversation", async () => {
    await recordSellerConversationAction(
      form({
        engagementId: "eng",
        propertyId: "prop-9",
        occurredAt: "2026-08-20T10:00",
        sourceType: "Call",
        summary: "Seller discussed the property.",
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/seller-crm");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/deals/prop-9");
    expect(mocks.sellerEngagementFindUnique).not.toHaveBeenCalled();
  });

  it("looks up the deal path from the engagement when propertyId is omitted", async () => {
    mocks.sellerEngagementFindUnique.mockResolvedValue({
      transaction: { propertyId: "prop-looked-up" },
    });
    await recordSellerConversationAction(
      form({
        engagementId: "eng",
        occurredAt: "2026-08-20T10:00",
        sourceType: "Call",
        summary: "Seller discussed the property.",
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/deals/prop-looked-up");
  });

  it("starts a seller thread on a deal without a transaction", async () => {
    await startSellerThreadOnDealAction(
      form({
        propertyId: "prop-new",
        channel: "PHONE",
        recipient: "3055550100",
        recipientLabel: "Pat Owner",
        purpose: "Seller relationship for this deal",
      }),
    );
    expect(mocks.createTransaction).toHaveBeenCalledWith({
      propertyId: "prop-new",
      actor: "owner",
    });
    expect(mocks.createEngagement).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionId: "tx-created",
        channel: "PHONE",
        recipient: "3055550100",
        purpose: "Seller relationship for this deal",
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/seller-crm");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/deals/prop-new");
  });

  it("starts a seller thread on an existing deal transaction without creating another", async () => {
    await startSellerThreadOnDealAction(
      form({
        propertyId: "prop-live",
        transactionId: "tx-live",
        channel: "SMS",
        recipient: "3055550100",
        purpose: "Seller relationship for this deal",
      }),
    );
    expect(mocks.createTransaction).not.toHaveBeenCalled();
    expect(mocks.createEngagement).toHaveBeenCalledWith(
      expect.objectContaining({ transactionId: "tx-live", channel: "SMS" }),
    );
  });
});
