export function permittedLocalTime(input: { localTime: string; permittedStart: string; permittedEnd: string }) {
  const valid = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (![input.localTime, input.permittedStart, input.permittedEnd].every((value) => valid.test(value))) return false;
  return input.localTime >= input.permittedStart && input.localTime < input.permittedEnd;
}

export function evaluateContactProcedure(input: { procedureStatus: string; requiredDisclosure?: string | null; counselApprovedAt?: Date | null; effectiveAt?: Date | null; expiresAt?: Date | null; trainingAcknowledged: boolean; listScrubAt?: Date | null; listScrubExpiresAt?: Date | null; permittedWindow: boolean; now?: Date }) {
  const blockers: string[] = [];
  const now = input.now ?? new Date();
  if (input.procedureStatus !== "ACTIVE" || !input.counselApprovedAt) blockers.push("counsel_approved_procedure_missing");
  if (!input.requiredDisclosure?.trim()) blockers.push("required_disclosure_missing");
  if (!input.effectiveAt || input.effectiveAt > now || !input.expiresAt || input.expiresAt <= now) blockers.push("procedure_not_current");
  if (!input.trainingAcknowledged) blockers.push("training_acknowledgment_missing");
  if (!input.listScrubAt || !input.listScrubExpiresAt || input.listScrubExpiresAt <= now) blockers.push("current_list_scrub_missing");
  if (!input.permittedWindow) blockers.push("outside_permitted_contact_window");
  return { allowed: blockers.length === 0, blockers };
}

