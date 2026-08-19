export function agentTaskDedupeKey(input: { agentId: string; taskType: string; transactionId?: string | null; propertyId?: string | null; developerId?: string | null; now?: Date }) {
  const cycle = Math.floor((input.now ?? new Date()).getTime() / (24 * 60 * 60_000));
  return [input.agentId, input.taskType, input.transactionId ?? "-", input.propertyId ?? "-", input.developerId ?? "-", cycle].join(":");
}
