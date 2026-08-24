export type VersionedAcquisitionGate = {
  type: string;
  version: number;
};

/**
 * Acquisition gates are append-only. Every decision must use the highest
 * version for each gate type so superseded evidence can never authorize or
 * block a deal.
 */
export function latestAcquisitionGates<T extends VersionedAcquisitionGate>(
  gates: readonly T[],
) {
  const latest = new Map<string, T>();

  for (const gate of gates) {
    const existing = latest.get(gate.type);
    if (!existing || gate.version > existing.version)
      latest.set(gate.type, gate);
  }

  return [...latest.values()].sort((left, right) =>
    left.type.localeCompare(right.type),
  );
}

export function latestAcquisitionGate<T extends VersionedAcquisitionGate>(
  gates: readonly T[],
  type: string,
) {
  return (
    latestAcquisitionGates(gates).find((gate) => gate.type === type) ?? null
  );
}
