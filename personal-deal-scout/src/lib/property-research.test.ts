import { describe, expect, it } from "vitest";
import { __propertyResearchTestables, propertyPhotoSourceUrls, PROPERTY_RESEARCH_VERSION } from "@/lib/property-research";

describe("property research source parsing", () => {
  it("finds real lazy-loaded and responsive photos instead of placeholders", () => {
    const html = '<img alt="1200 Main Street" src="/placeholder.gif" data-src="/front.jpg"><img alt="1200 Main Street rear" srcset="/rear-small.jpg 320w, /rear-large.jpg 1200w"><img alt="Different Road" src="/other.jpg">';
    expect(__propertyResearchTestables.listingImageUrls(html, "https://listing.example.com/home", "1200 Main Street"))
      .toEqual(["https://listing.example.com/front.jpg", "https://listing.example.com/rear-large.jpg"]);
  });

  it("reads structured photo objects with spaced script attributes, excluding agent logos", () => {
    const html = '<script type = "application/ld+json">{"@graph":[{"@type":"RealEstateAgent","image":"https://listing.example.com/logo.jpg"},{"@type":"House","address":{"streetAddress":"1200 Main Street","addressLocality":"Jackson","postalCode":"39201"},"photo":{"@type":"ImageObject","url":"/house.jpg"}}]}</script>';
    expect(__propertyResearchTestables.listingImageUrls(html, "https://listing.example.com/home", "1200 Main Street")).toEqual(["https://listing.example.com/house.jpg"]);
    expect(__propertyResearchTestables.pageMatchesProperty(html, { address: "1200 Main Street", city: "Jackson", state: "MS", zipCode: "39201" })).toBe(true);
  });

  it("deduplicates photos and excludes unsafe image targets", () => {
    const html = '<meta property="og:image" content="https://127.0.0.1/private.jpg"><meta property="twitter:image" content="/front.jpg"><img alt="1200 Main" data-original="/front.jpg">';
    expect(__propertyResearchTestables.listingImageUrls(html, "https://listing.example.com/home", "1200 Main Street")).toEqual(["https://listing.example.com/front.jpg"]);
  });

  it("uses known listing evidence without fetching conflicting or unrelated evidence", () => {
    expect(propertyPhotoSourceUrls({ sourceUrl: "https://listing.example.com/a", verificationSourceUrl: "https://listing.example.com/a", findings: [
      { topic: "LISTING", status: "VERIFIED", sourceUrl: "https://listing.example.com/b" },
      { topic: "TAX", status: "VERIFIED", sourceUrl: "https://county.example.com/tax" },
      { topic: "PHOTOS", status: "CONFLICT", sourceUrl: "https://listing.example.com/conflict" },
    ] })).toEqual(["https://listing.example.com/a", "https://listing.example.com/b"]);
    expect(PROPERTY_RESEARCH_VERSION).toBeGreaterThan(3);
  });

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

  it("bounds adversarial JSON-LD traversal depth", () => {
    const property = { address: "1200 Main Street", city: "Jackson", state: "MS", zipCode: "39201" };
    let nested: unknown = { streetAddress: "1200 Main Street", addressLocality: "Jackson", postalCode: "39201" };
    for (let depth = 0; depth < 20; depth += 1) nested = { child: nested };
    const html = `<script type="application/ld+json">${JSON.stringify(nested)}</script>`;
    expect(__propertyResearchTestables.pageMatchesProperty(html, property)).toBe(false);
  });

  it("treats sufficient evidence as usable without requiring every research topic", () => {
    const verified = (topic: string) => ({ topic, status: "VERIFIED" as const });
    expect(__propertyResearchTestables.hasSufficientResearchEvidence([verified("LOCATION"), verified("PARCEL"), verified("TAX")])).toBe(true);
    expect(__propertyResearchTestables.hasSufficientResearchEvidence([verified("LOCATION"), verified("OWNERSHIP")], "GOVERNMENT_SALE")).toBe(true);
    expect(__propertyResearchTestables.hasSufficientResearchEvidence([verified("LOCATION"), verified("PARCEL"), { topic: "PRICE", status: "CONFLICT" as const }])).toBe(false);
  });
});
