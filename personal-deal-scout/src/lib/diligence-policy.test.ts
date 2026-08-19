import { describe, expect, it } from "vitest";
import { evaluateDiligence } from "@/lib/diligence-policy";

describe("two-level diligence", () => {
  it("verifies preliminary diligence only with every required sourced fact", () => expect(evaluateDiligence({ level: "PRELIMINARY", verifiedTopics: ["LOCATION", "PARCEL", "OWNERSHIP", "TAX", "LIENS", "ZONING", "FLOOD", "UTILITIES", "ACCESS", "EASEMENTS", "COVENANTS", "HISTORIC", "ENVIRONMENTAL", "DIMENSIONS", "COMPS"], sourceCount: 8 }).verified).toBe(true));
  it("requires preliminary verification and professional artifacts before enhanced diligence", () => expect(evaluateDiligence({ level: "ENHANCED", verifiedTopics: [], professionalArtifactCategories: [], preliminaryStatus: "NEEDS_MANUAL_VERIFICATION", sourceCount: 1 }).verified).toBe(false));
});
