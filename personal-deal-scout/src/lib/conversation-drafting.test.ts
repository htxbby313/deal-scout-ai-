import { describe, expect, it } from "vitest";
import {
  planDeveloperConversationRoute,
  planSellerConversationDraft,
} from "@/lib/conversation-drafting";

describe("conversation drafting", () => {
  it("requires a seller phone but treats email as a follow-up request", () => {
    expect(
      planSellerConversationDraft({ address: "1 Main St", contactName: "Pat" }),
    ).toEqual({ ready: false, missing: ["seller phone"] });
    const plan = planSellerConversationDraft({
      address: "1 Main St",
      contactName: "Pat",
      phone: "210-555-0100",
    });
    expect(plan.ready).toBe(true);
    if (plan.ready) {
      expect(plan.missing).toEqual(["email"]);
      expect(plan.body).toContain("confirm the best email");
    }
  });

  it("uses a known owner name when the seller contact name is pending", () => {
    const plan = planSellerConversationDraft({
      address: "1 Main St",
      contactName: "Research pending",
      ownerName: "Taylor Owner",
      phone: "210-555-0100",
    });
    expect(plan.ready && plan.recipientLabel).toBe("Taylor Owner");
  });

  it("allows any public developer contact route and requests missing details", () => {
    const plan = planDeveloperConversationRoute({
      website: "https://builder.example",
    });
    expect(plan.ready).toBe(true);
    if (plan.ready)
      expect(plan.missing).toEqual([
        "acquisitions contact name",
        "business email",
        "business phone",
      ]);
  });

  it("blocks a developer draft only when no public contact route exists", () => {
    const plan = planDeveloperConversationRoute({});
    expect(plan.ready).toBe(false);
    expect(plan.missing).toContain("public contact route");
  });
});
