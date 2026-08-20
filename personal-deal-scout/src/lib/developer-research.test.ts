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

  it("extracts an attributable builder project from official structured metadata", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@type": "HomeAndConstructionBusiness",
      name: "Applewhite Meadows",
      address: { streetAddress: "10330 Gala Junction", addressLocality: "San Antonio", addressRegion: "TX", postalCode: "78224" },
      parentOrganization: { name: "Century Communities" },
      telephone: "+12105043030",
    })}</script>`;
    expect(__developerResearchTestables.structuredProjects(html)).toEqual([expect.objectContaining({ name: "Applewhite Meadows", zipCode: "78224", organization: "Century Communities" })]);
    expect(__developerResearchTestables.companyMatchesOrganization("Century Communities II, LLC", "Century Communities")).toBe(true);
  });

  it("does not attribute a project to an unrelated developer", () => {
    expect(__developerResearchTestables.companyMatchesOrganization("Example Homes LLC", "Century Communities")).toBe(false);
  });
});
