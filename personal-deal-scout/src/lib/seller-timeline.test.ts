import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  sellerEngagement: { findUnique: vi.fn() },
  sellerConversation: { findMany: vi.fn() },
  sellerContactAttempt: { findMany: vi.fn() },
  sellerFollowUp: { findMany: vi.fn() },
  sellerOfferHistory: { findMany: vi.fn() },
  sellerLeadDisposition: { findMany: vi.fn() },
  sellerFactVersion: { findMany: vi.fn() },
  contactConsent: { findMany: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ getPrisma: () => db }));

import { readSellerTimeline } from "@/lib/seller-crm";

describe("seller timeline persistence boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.sellerConversation.findMany.mockResolvedValue([]);
    db.sellerContactAttempt.findMany.mockResolvedValue([]);
    db.sellerFollowUp.findMany.mockResolvedValue([]);
    db.sellerOfferHistory.findMany.mockResolvedValue([]);
    db.sellerLeadDisposition.findMany.mockResolvedValue([]);
    db.sellerFactVersion.findMany.mockResolvedValue([]);
    db.contactConsent.findMany.mockResolvedValue([]);
  });

  it("rejects history requests for an engagement outside the accessible data set", async () => {
    db.sellerEngagement.findUnique.mockResolvedValue(null);
    await expect(readSellerTimeline("hidden")).rejects.toThrow(
      "Seller engagement not found",
    );
    expect(db.sellerConversation.findMany).not.toHaveBeenCalled();
  });

  it("queries only the selected engagement with a bounded initial page", async () => {
    db.sellerEngagement.findUnique.mockResolvedValue({ id: "eng-1" });
    await readSellerTimeline("eng-1", 0, 20);
    for (const model of [
      db.sellerConversation,
      db.sellerContactAttempt,
      db.sellerFollowUp,
      db.sellerOfferHistory,
      db.sellerLeadDisposition,
      db.sellerFactVersion,
      db.contactConsent,
    ]) {
      expect(model.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { engagementId: "eng-1" }, take: 21 }),
      );
    }
  });
});
