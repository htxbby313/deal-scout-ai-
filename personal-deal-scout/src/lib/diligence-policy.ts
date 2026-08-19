import type { DiligenceLevel, DiligenceStatus } from "@prisma/client";

const preliminaryTopics = ["LOCATION", "PARCEL", "OWNERSHIP", "TAX", "LIENS", "ZONING", "FLOOD", "UTILITIES", "ACCESS", "EASEMENTS", "COVENANTS", "HISTORIC", "ENVIRONMENTAL", "DIMENSIONS", "COMPS"] as const;
const professionalCategories = ["TITLE", "SURVEY", "ZONING", "UTILITIES", "ACCESS", "ENVIRONMENTAL", "LEGAL_DOCUMENTS", "CLOSING_CONDITIONS"] as const;

export function evaluateDiligence(input: { level: DiligenceLevel; verifiedTopics: string[]; professionalArtifactCategories?: string[]; preliminaryStatus?: DiligenceStatus; sourceCount: number }) {
  const missingTopics = input.level === "PRELIMINARY" ? preliminaryTopics.filter((topic) => !input.verifiedTopics.includes(topic)) : [];
  const missingProfessionalArtifacts = input.level === "ENHANCED" ? professionalCategories.filter((category) => !input.professionalArtifactCategories?.includes(category)) : [];
  const reasons: string[] = [];
  if (input.sourceCount < 1) reasons.push("At least one attributable public source is required.");
  if (missingTopics.length) reasons.push(`Missing verified topics: ${missingTopics.join(", ")}.`);
  if (input.level === "ENHANCED" && input.preliminaryStatus !== "VERIFIED") reasons.push("Verified preliminary diligence is required first.");
  if (missingProfessionalArtifacts.length) reasons.push(`Missing professional artifacts: ${missingProfessionalArtifacts.join(", ")}.`);
  return { verified: reasons.length === 0, missingTopics, missingProfessionalArtifacts, reasons };
}
