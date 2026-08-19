export type SettlementFields = {
  closingDate: Date;
  sellerProceeds?: number;
  assignmentFee?: number;
  transactionCosts?: number;
};

export function validateSettlementFields(input: SettlementFields, now = new Date()) {
  const reasons: string[] = [];
  if (input.closingDate > now) reasons.push("Closing date cannot be in the future.");
  for (const [field, value] of Object.entries({ sellerProceeds: input.sellerProceeds, assignmentFee: input.assignmentFee, transactionCosts: input.transactionCosts })) {
    if (value !== undefined && (!Number.isInteger(value) || value < 0)) reasons.push(`${field} must be a non-negative integer.`);
  }
  if (input.sellerProceeds === undefined && input.assignmentFee === undefined && input.transactionCosts === undefined) reasons.push("At least one reviewed settlement amount is required.");
  return { valid: reasons.length === 0, reasons };
}

export function applySettlementCorrections<T extends SettlementFields>(original: T, corrections: Array<Partial<SettlementFields>>) {
  return corrections.reduce<T>((current, correction) => ({ ...current, ...correction }), original);
}
