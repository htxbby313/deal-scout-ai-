import { describe, expect, it } from "vitest";
import { __propertyResearchTestables } from "@/lib/property-research";

describe("property research source parsing", () => {
  it("extracts attributed Open Graph photos regardless of attribute order", () => {
    const html = '<meta content="/photos/parcel.jpg" property="og:image"><meta name="twitter:image" content="https://cdn.example.com/front.jpg">';
    expect(__propertyResearchTestables.imageUrls(html, "https://listing.example.com/property/1")).toEqual(["https://listing.example.com/photos/parcel.jpg", "https://cdn.example.com/front.jpg"]);
  });

  it("rejects private and non-HTTPS research targets", () => {
    expect(() => __propertyResearchTestables.safePublicUrl("http://example.com")).toThrow("HTTPS");
    expect(() => __propertyResearchTestables.safePublicUrl("https://127.0.0.1/secret")).toThrow("Private network");
  });
});
