import { describe, expect, it } from "vitest";
import { __developerResearchTestables } from "@/lib/developer-research";

describe("developer public-source research", () => {
  it("accepts public HTTPS sources", () => {
    expect(__developerResearchTestables.safePublicUrl("https://example.com/contact").hostname).toBe("example.com");
  });

  it("rejects insecure and private-network sources", () => {
    expect(() => __developerResearchTestables.safePublicUrl("http://example.com")).toThrow("HTTPS");
    expect(() => __developerResearchTestables.safePublicUrl("https://127.0.0.1/private")).toThrow("Private network");
  });
});
