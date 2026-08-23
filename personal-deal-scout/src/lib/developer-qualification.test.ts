import { describe, expect, it } from "vitest";
import { developerRelationshipQualification } from "@/lib/developer-qualification";

describe("developer relationship qualification", () => {
  it("qualifies a developer from one usable public business channel without purchase history", () => {
    expect(developerRelationshipQualification({ website: "https://builder.example" })).toBe("QUALIFIED");
    expect(developerRelationshipQualification({ email: "land@builder.example" })).toBe("QUALIFIED");
    expect(developerRelationshipQualification({ phone: "210-555-0100" })).toBe("QUALIFIED");
  });

  it("prioritizes a named contact with multiple channels", () => {
    expect(developerRelationshipQualification({ contactName: "Land acquisitions", email: "land@builder.example", phone: "210-555-0100" })).toBe("PRIORITY");
  });

  it("keeps buyer capacity and property fit outside relationship qualification", () => {
    expect(developerRelationshipQualification({})).toBe("RESEARCH_NEEDED");
  });
});
