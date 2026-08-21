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

  it("extracts listing phones and address-matched source images", () => {
    const html = '<div>Listed by Agent · (210) 386-7583</div><img alt="0 Claymore San Antonio" src="https://images.example.com/claymore.jpg">';
    expect(__propertyResearchTestables.phoneNumbers(html)).toEqual(["(210) 386-7583"]);
    expect(__propertyResearchTestables.listingImageUrls(html, "https://listing.example.com/0-claymore", "0 Claymore")).toContain("https://images.example.com/claymore.jpg");
  });

  it("requires a public page to match the property before treating it as evidence", () => {
    const property = { address: "1200 Main Street", city: "Jackson", state: "MS", zipCode: "39201" };
    expect(__propertyResearchTestables.pageMatchesProperty("<title>1200 Main Street, Jackson MS 39201</title>", property)).toBe(true);
    expect(__propertyResearchTestables.pageMatchesProperty("<title>1400 Oak Avenue, Biloxi MS 39530</title>", property)).toBe(false);
  });

  it("preserves JSON-LD addresses when matching a listing", () => {
    const property = { address: "1200 Main Street", city: "Jackson", state: "MS", zipCode: "39201" };
    const html = `<script type="application/ld+json">{"@type":"Residence","address":{"streetAddress":"1200 Main Street","addressLocality":"Jackson","addressRegion":"MS","postalCode":"39201"}}</script>`;
    expect(__propertyResearchTestables.pageMatchesProperty(html, property)).toBe(true);
  });

  it("treats sufficient evidence as usable without requiring every research topic", () => {
    const verified = (topic: string) => ({ topic, status: "VERIFIED" as const });
    expect(__propertyResearchTestables.hasSufficientResearchEvidence([verified("LOCATION"), verified("PARCEL"), verified("TAX")])).toBe(true);
    expect(__propertyResearchTestables.hasSufficientResearchEvidence([verified("LOCATION"), verified("OWNERSHIP")], "GOVERNMENT_SALE")).toBe(true);
    expect(__propertyResearchTestables.hasSufficientResearchEvidence([verified("LOCATION"), verified("PARCEL"), { topic: "PRICE", status: "CONFLICT" as const }])).toBe(false);
  });
});
