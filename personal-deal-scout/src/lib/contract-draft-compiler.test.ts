import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import variableSchema from "../../contracts/review-pending/contract-variables.schema.json";
import { compileContractSet, compileContractTemplate, listContractTemplateVariables } from "./contract-draft-compiler";

const directory = join(process.cwd(), "contracts", "review-pending");
const acquisitionTemplate = readFileSync(join(directory, "Assignable_Creative_Financing_Contract.md"), "utf8");
const assignmentTemplate = readFileSync(join(directory, "Closing_and_Assignment_Contract.md"), "utf8");
const variables = {
  buyer_name: "Coleman & Co. Holdings LLC",
  seller_name: "Example Seller",
  assignor_name: "Coleman & Co. Holdings LLC",
  assignee_name: "Example End Buyer LLC",
  primary_agreement_date: "2026-08-19",
  inspection_expiration_date: "2026-08-29",
  property_address: "100 Example Street, Austin, TX 78701",
  legal_description: "Lot 1, Block A, Example Addition",
  purchase_price: "500000.00",
  inspection_days: 10,
  access_notice_hours: 24,
  due_on_sale_risk: "buyer" as const,
  due_on_sale_resolution_days: 30,
  default_grace_days: 15,
  cure_days: 10,
  end_buyer_emd: "10000.00",
  assignment_fee: "25000.00",
  escrow_servicer_name: "Example Licensed Servicer",
  escrow_fee_allocation: "split" as const,
};

describe("contract draft compiler", () => {
  it("keeps the JSON schema aligned with every template token", () => {
    const tokens = listContractTemplateVariables(`${acquisitionTemplate}\n${assignmentTemplate}`);
    expect(tokens).toEqual([...variableSchema.required].sort());
    expect(Object.keys(variableSchema.properties).sort()).toEqual(tokens);
  });

  it("compiles both supplied drafts with no unresolved tokens and no execution authority", () => {
    const result = compileContractSet({ acquisitionTemplate, assignmentTemplate, variables });
    expect(result.acquisition).toContain("Coleman & Co. Holdings LLC");
    expect(result.acquisition).toContain("Buyer's Responsibility");
    expect(result.acquisition).not.toContain("Seller's Responsibility");
    expect(result.assignment).toContain("$25000.00");
    expect(`${result.acquisition}${result.assignment}`).not.toContain("{{");
    expect(result).toMatchObject({ status: "REVIEW_PENDING", activationAuthorized: false });
  });

  it("selects the seller risk branch without leaking the buyer branch", () => {
    const result = compileContractTemplate(acquisitionTemplate, { ...variables, due_on_sale_risk: "seller" });
    expect(result.output).toContain("Seller's Responsibility");
    expect(result.output).not.toContain("Buyer's Responsibility");
  });

  it("rejects floating money, missing values, extra values, and unsupported template logic", () => {
    expect(() => compileContractTemplate(acquisitionTemplate, { ...variables, purchase_price: 500000 })).toThrow();
    expect(() => compileContractTemplate(acquisitionTemplate, { ...variables, buyer_name: "" })).toThrow();
    expect(() => compileContractTemplate(acquisitionTemplate, { ...variables, surprise: "value" })).toThrow();
    expect(() => compileContractTemplate(`${acquisitionTemplate}\n{{unsupported_token}}`, variables)).toThrow(/unresolved/);
  });
});
