import { z } from "zod";

const money = z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d{2})$/, "Money must be an exact decimal string with two digits after the decimal point.");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Dates must use YYYY-MM-DD.").refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Date is not valid.");
const safeText = z.string().trim().min(1).refine((value) => !/[{}\0]/.test(value), "Contract values cannot contain template delimiters or null bytes.");

export const contractVariablesSchema = z.object({
  buyer_name: safeText,
  seller_name: safeText,
  assignor_name: safeText,
  assignee_name: safeText,
  primary_agreement_date: isoDate,
  inspection_expiration_date: isoDate,
  property_address: safeText,
  legal_description: safeText,
  purchase_price: money,
  inspection_days: z.number().int().positive().default(10),
  access_notice_hours: z.number().int().positive().default(24),
  due_on_sale_risk: z.enum(["buyer", "seller"]),
  due_on_sale_resolution_days: z.number().int().positive().default(30),
  default_grace_days: z.number().int().positive().default(15),
  cure_days: z.number().int().positive().default(10),
  end_buyer_emd: money,
  assignment_fee: money,
  escrow_servicer_name: safeText.default("To be mutually selected prior to closing"),
  escrow_fee_allocation: z.enum(["buyer", "seller", "split"]),
}).strict();

export type ContractVariables = z.infer<typeof contractVariablesSchema>;

const conditional = /{{#if_eq due_on_sale_risk "buyer"}}([\s\S]*?){{else}}([\s\S]*?){{\/if_eq}}/g;
const unresolved = /{{[^}]+}}/g;

export function listContractTemplateVariables(template: string) {
  const values = [...template.matchAll(/{{([a-z][a-z0-9_]*)}}/g)].map((match) => match[1]).filter((value) => value !== "else");
  const conditions = [...template.matchAll(/{{#if_eq ([a-z][a-z0-9_]*) /g)].map((match) => match[1]);
  return [...new Set([...values, ...conditions])].sort();
}

export function compileContractTemplate(template: string, rawVariables: unknown) {
  const variables = contractVariablesSchema.parse(rawVariables);
  let output = template.replace(conditional, variables.due_on_sale_risk === "buyer" ? "$1" : "$2");
  for (const [key, raw] of Object.entries(variables)) output = output.replaceAll(`{{${key}}}`, String(raw));
  const remaining = output.match(unresolved) ?? [];
  if (remaining.length) throw new Error(`Contract template contains unresolved or unsupported tokens: ${[...new Set(remaining)].join(", ")}`);
  return { output, variables, activationAuthorized: false as const, status: "REVIEW_PENDING" as const };
}

export function compileContractSet(input: { acquisitionTemplate: string; assignmentTemplate: string; variables: unknown }) {
  const acquisition = compileContractTemplate(input.acquisitionTemplate, input.variables);
  const assignment = compileContractTemplate(input.assignmentTemplate, acquisition.variables);
  return { acquisition: acquisition.output, assignment: assignment.output, variables: acquisition.variables, activationAuthorized: false as const, status: "REVIEW_PENDING" as const };
}
