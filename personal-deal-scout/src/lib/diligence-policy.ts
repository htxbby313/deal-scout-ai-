import type { DiligenceLevel, DiligenceStatus } from "@prisma/client";

const preliminaryTopics = ["LISTING", "LOCATION", "OWNERSHIP", "PRICE"] as const;
const enhancedTopics = ["OWNERSHIP", "TAX", "ZONING", "FLOOD", "UTILITIES", "ACCESS", "COMPS"] as const;

export function evaluateDiligence(input: { level: DiligenceLevel; verifiedTopics: string[]; preliminaryStatus?: DiligenceStatus; sourceCount: number }) {
  const required = input.level === "PRELIMINARY" ? preliminaryTopics : enhancedTopics;
  const missingTopics = required.filter((topic) => !input.verifiedTopics.includes(topic));
  const reasons: string[] = [];
  if (input.sourceCount < 1) reasons.push("At least one attributable public source is required.");
  if (missingTopics.length) reasons.push(`Missing verified topics: ${missingTopics.join(", ")}.`);
  if (input.level === "ENHANCED" && input.preliminaryStatus !== "VERIFIED") reasons.push("Verified preliminary diligence is required first.");
  return { verified: reasons.length === 0, missingTopics, reasons };
}
