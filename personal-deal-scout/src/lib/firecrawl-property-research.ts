import "server-only";

import { z } from "zod";
import { fetchValidatedJson, stableUnique } from "@/lib/research-runtime";
import { isSafePublicEvidenceUrl } from "@/lib/research-freshness";

const FIRECRAWL_SCRAPE_URL = "https://api.firecrawl.dev/v2/scrape";
const FIRECRAWL_SEARCH_URL = "https://api.firecrawl.dev/v2/search";

const firecrawlScrapeSchema = z.object({
  success: z.boolean(),
  data: z
    .object({
      markdown: z.string().optional(),
      links: z.array(z.string()).optional(),
      images: z.array(z.string()).optional(),
      metadata: z
        .object({
          title: z.string().optional(),
          sourceURL: z.string().optional(),
          url: z.string().optional(),
          statusCode: z.number().optional(),
          scrapeId: z.string().optional(),
        })
        .passthrough()
        .optional(),
    })
    .passthrough()
    .optional(),
  error: z.string().optional(),
});

const firecrawlSearchSchema = z.object({
  success: z.boolean(),
  data: z.object({
    web: z.array(z.object({
      url: z.string(),
      title: z.string().optional(),
      description: z.string().optional(),
    })).optional(),
  }).optional(),
  error: z.string().optional(),
});

export type FirecrawlPropertyPage = {
  markdown: string;
  title?: string;
  sourceUrl: string;
  images: string[];
  links: string[];
  receipt?: string;
};

export function firecrawlConfigured() {
  return (
    process.env.FIRECRAWL_ENABLED === "true" &&
    Boolean(process.env.FIRECRAWL_API_KEY?.trim())
  );
}

export function firecrawlMaxRequestsPerRun() {
  const value = Number.parseInt(
    process.env.FIRECRAWL_MAX_REQUESTS_PER_RUN || "2",
    10,
  );
  return Number.isInteger(value) ? Math.max(0, Math.min(value, 6)) : 2;
}

export async function searchPropertySourcesWithFirecrawl(query: string) {
  if (!firecrawlConfigured())
    throw new Error("Firecrawl property research is not configured.");
  const key = process.env.FIRECRAWL_API_KEY?.trim();
  if (!key) throw new Error("Firecrawl property research is not configured.");
  const response = await fetchValidatedJson(FIRECRAWL_SEARCH_URL, firecrawlSearchSchema, {
    method: "POST",
    attempts: 3,
    timeoutMs: 15_000,
    maxBytes: 1_000_000,
    minimumHostIntervalMs: 250,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query, limit: 5, sources: ["web"] }),
  });
  if (!response.success)
    throw new Error(response.error || "Firecrawl property search failed.");
  return (response.data?.web || [])
    .filter((result) => isSafePublicEvidenceUrl(result.url))
    .slice(0, 5);
}

export async function scrapePropertySourceWithFirecrawl(
  rawUrl: string,
): Promise<FirecrawlPropertyPage> {
  if (!firecrawlConfigured())
    throw new Error("Firecrawl property research is not configured.");
  if (!isSafePublicEvidenceUrl(rawUrl))
    throw new Error("Firecrawl sources must be safe public HTTPS URLs.");

  const key = process.env.FIRECRAWL_API_KEY?.trim();
  if (!key) throw new Error("Firecrawl property research is not configured.");

  const response = await fetchValidatedJson(
    FIRECRAWL_SCRAPE_URL,
    firecrawlScrapeSchema,
    {
      method: "POST",
      attempts: 3,
      timeoutMs: 15_000,
      maxBytes: 2_000_000,
      minimumHostIntervalMs: 250,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        url: rawUrl,
        formats: ["markdown", "links", "images"],
        onlyMainContent: true,
        removeBase64Images: true,
        blockAds: true,
        timeout: 10_000,
      }),
    },
  );

  if (!response.success || !response.data)
    throw new Error(response.error || "Firecrawl did not return page content.");

  const sourceUrl =
    response.data.metadata?.sourceURL ||
    response.data.metadata?.url ||
    rawUrl;
  if (!isSafePublicEvidenceUrl(sourceUrl))
    throw new Error("Firecrawl returned an unsafe source URL.");

  return {
    markdown: (response.data.markdown || "").slice(0, 1_500_000),
    title: response.data.metadata?.title,
    sourceUrl,
    images: stableUnique(response.data.images || [])
      .filter(isSafePublicEvidenceUrl)
      .slice(0, 12),
    links: stableUnique(response.data.links || [])
      .filter(isSafePublicEvidenceUrl)
      .slice(0, 100),
    receipt: response.data.metadata?.scrapeId,
  };
}

export const __firecrawlPropertyResearchTestables = {
  FIRECRAWL_SCRAPE_URL,
  FIRECRAWL_SEARCH_URL,
  firecrawlScrapeSchema,
  firecrawlSearchSchema,
};
