import { z } from "zod";

const zillowReferenceSchema = z.object({
  url: z.string().trim().url().max(2_048),
  observedAddress: z.string().trim().max(300).optional(),
  observedAskingPrice: z.number().nonnegative().finite().optional(),
  observedAvailability: z.string().trim().max(100).optional(),
  observationNotes: z.string().trim().max(2_000).optional(),
});

export type ZillowDiscoveryInput = z.infer<typeof zillowReferenceSchema>;

export function normalizeZillowPropertyUrl(value: string) {
  const url = new URL(value.trim());
  if (url.protocol !== "https:") throw new Error("Zillow references must use HTTPS.");
  if (url.username || url.password || url.port) throw new Error("Zillow references cannot contain credentials or a custom port.");
  const host = url.hostname.toLowerCase();
  if (host !== "zillow.com" && host !== "www.zillow.com") throw new Error("Only Zillow property links are accepted.");
  if (!/^\/homedetails\/[^/]+\/\d+_zpid\/?$/i.test(url.pathname)) throw new Error("Use a direct Zillow property page, not a search or results page.");
  url.hostname = "www.zillow.com";
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function prepareZillowDiscoveryReference(input: ZillowDiscoveryInput) {
  const parsed = zillowReferenceSchema.parse(input);
  return {
    providerKey: "ZILLOW" as const,
    originalUrl: parsed.url,
    normalizedUrl: normalizeZillowPropertyUrl(parsed.url),
    observedAddress: parsed.observedAddress || null,
    observedAskingPrice: parsed.observedAskingPrice ?? null,
    observedAvailability: parsed.observedAvailability || null,
    observationNotes: parsed.observationNotes || null,
    verificationStatus: "USER_OBSERVED_UNVERIFIED" as const,
    fetched: false as const,
  };
}

export function buildZillowSearchLink(location: string) {
  const safeLocation = location.trim().slice(0, 200);
  if (!safeLocation) throw new Error("A public location is required.");
  return `https://www.zillow.com/homes/${encodeURIComponent(safeLocation)}_rb/`;
}
