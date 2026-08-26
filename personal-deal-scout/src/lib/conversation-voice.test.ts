import { describe, expect, it } from "vitest";
import { buyerIntroduction, currentBuiltInTemplate, greeting, propertyPackageInquiry, refreshLegacyIntroduction, sellerIntroduction, sellerIntroductionTemplate } from "@/lib/conversation-voice";

describe("Tay's inquiry-first conversation voice", () => {
  it("uses the approved buyer inquiry without unverified market or familiarity claims", () => {
    const body = buyerIntroduction("Jordan");
    expect(body).toContain("Hi Jordan,");
    expect(body).toContain("I'm Tay");
    expect(body).toContain("rather start with what you actually want to buy");
    expect(body.match(/\?/g)).toHaveLength(1);
    for (const internal of ["Contact route:", "buy box", "No property is being offered", "I’m Cole", "off-market"]) expect(body).not.toContain(internal);
  });
  it("does not greet placeholders as people or invent a first name", () => {
    for (const name of [undefined, "Unknown Owner", "Research pending", "Property contact"]) expect(greeting(name)).toBe("Hi,");
    expect(greeting("Alex Morgan")).toBe("Hi Alex Morgan,");
  });
  it("keeps the seller opening a question rather than assuming distress or a sale", () => {
    const body = sellerIntroduction({ address: "1 Main St", hasPhone: true });
    expect(body).toContain("plans for it?");
    expect(body).not.toMatch(/cash offer|motivated|distress|email/);
  });
  it("preserves contract-interest disclosure without making up buy-box fit", () => {
    const body = propertyPackageInquiry({ address: "1 Main St", zipCode: "78201" });
    expect(body).toContain("holds a documented contractual interest");
    expect(body).not.toMatch(/verified acquisition criteria|unknown|Contact route/);
    expect(body).toContain("Tay");
  });
  it("updates only the exact built-in template, preserving custom text and disclosures", () => {
    expect(currentBuiltInTemplate("Hi [OWNER], I am researching the property at [PROPERTY]. Would you be open to a conversation?")).toBe(sellerIntroductionTemplate);
    const custom = "Hi [OWNER], custom introduction. Required disclosure.";
    expect(currentBuiltInTemplate(custom)).toBe(custom);
  });
  it("refreshes exact legacy drafts but never strips edits or appended disclosures", () => {
    const old = "Hi Pat, this is Cole with Coleman & Co. Holdings LLC. I am reaching out about 1 Main St. Would you be open to a brief conversation about the property and your plans for it? There is no obligation. I would also like to confirm the best email for this conversation.";
    expect(refreshLegacyIntroduction(old)).toContain("I'm Tay");
    expect(refreshLegacyIntroduction(old + " Required disclosure.")).toBeNull();
    expect(refreshLegacyIntroduction("Owner edited: " + old)).toBeNull();
    expect(refreshLegacyIntroduction(buyerIntroduction("Pat"))).toBeNull();
  });
  it("recognizes the exact former buyer introduction and removes internal checklists", () => {
    const old = "Hello Pat,\n\nI’m Cole with Coleman & Co. Holdings LLC. We research off-market acquisition opportunities and would like to learn your current buy box before discussing any specific property. Could you confirm your target markets, property types, price range, closing timeline, and the best acquisitions contact? We also need to confirm your business phone.\n\nNo property is being offered in this message. We will only present a specific opportunity after we hold the necessary contractual interest and the transaction is cleared for disposition.\n\nContact route: https://example.com";
    expect(refreshLegacyIntroduction(old)).toBe(buyerIntroduction("Pat"));
    expect(refreshLegacyIntroduction(old + "\nRequired disclosure.")).toBeNull();
  });
});
