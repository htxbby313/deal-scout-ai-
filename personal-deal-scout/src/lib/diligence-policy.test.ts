import { describe, expect, it } from "vitest";
import { evaluateDiligence } from "@/lib/diligence-policy";

describe("two-level diligence", () => {
  it("verifies preliminary diligence only with core sourced facts", () => expect(evaluateDiligence({ level: "PRELIMINARY", verifiedTopics: ["LISTING", "LOCATION", "OWNERSHIP", "PRICE"], sourceCount: 2 }).verified).toBe(true));
  it("requires preliminary verification before enhanced diligence", () => expect(evaluateDiligence({ level: "ENHANCED", verifiedTopics: ["OWNERSHIP", "TAX", "ZONING", "FLOOD", "UTILITIES", "ACCESS", "COMPS"], preliminaryStatus: "NEEDS_MANUAL_VERIFICATION", sourceCount: 7 }).verified).toBe(false));
});
