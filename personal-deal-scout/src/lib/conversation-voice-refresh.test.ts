import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  buyerFind: vi.fn(), sellerFind: vi.fn(), buyerUpdate: vi.fn(), sellerUpdate: vi.fn(), audit: vi.fn(), transaction: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ getPrisma: () => ({
  messageApproval: { findMany: mocks.buyerFind },
  sellerEngagement: { findMany: mocks.sellerFind },
  $transaction: mocks.transaction,
}) }));
import { refreshPendingConversationVoice } from "@/lib/conversation-voice-refresh";

const old = "Hi Pat, this is Cole with Coleman & Co. Holdings LLC. I am reaching out about 1 Main St. Would you be open to a brief conversation about the property and your plans for it? There is no obligation.";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.buyerFind.mockResolvedValue([]);
  mocks.sellerFind.mockResolvedValue([{ id: "s1", purpose: old }]);
  mocks.sellerUpdate.mockResolvedValue({ count: 1 });
  mocks.transaction.mockImplementation((fn) => fn({ sellerEngagement: { updateMany: mocks.sellerUpdate }, messageApproval: { updateMany: mocks.buyerUpdate }, auditLog: { create: mocks.audit } }));
});

describe("legacy draft refresh protections", () => {
  it("checks approvals, prior contacts and stopped transactions again at write time", async () => {
    expect((await refreshPendingConversationVoice()).refreshed).toBe(1);
    expect(mocks.buyerFind.mock.calls[0][0].where).toMatchObject({ status: "PENDING", provider: "disabled" });
    expect(mocks.sellerUpdate.mock.calls[0][0].where).toMatchObject({
      purpose: old, ownerApprovedAt: null, completedAt: null,
      status: { in: ["DRAFT", "BLOCKED", "READY_FOR_OWNER_REVIEW"] },
      contactAttempts: { none: {} }, conversations: { none: {} },
      transaction: { controlStatus: { not: "STOPPED" } },
    });
    expect(mocks.audit.mock.calls[0][0].data.details.previousBody).toBe(old);
    expect(mocks.audit.mock.calls[0][0].data.details.revisedBody).toContain("I'm Tay");
  });
  it("does not record a refresh if approval or editing wins the race", async () => {
    mocks.sellerUpdate.mockResolvedValue({ count: 0 });
    expect((await refreshPendingConversationVoice()).refreshed).toBe(0);
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("leaves owner additions and disclosures untouched", async () => {
    mocks.sellerFind.mockResolvedValue([{ id: "s1", purpose: old + " Required disclosure." }]);
    expect((await refreshPendingConversationVoice()).refreshed).toBe(0);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
