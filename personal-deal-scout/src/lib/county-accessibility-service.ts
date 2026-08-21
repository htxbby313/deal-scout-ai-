import "server-only";
import { createHash } from "node:crypto";
import { getPrisma } from "@/lib/prisma";
import { classifyCountyAccessibility, requireReviewedCountyAdapter, safeCountyAccessibilityUrl } from "@/lib/county-accessibility";
import { recordCountySourceCheck } from "@/lib/county-source-service";

export async function runCountyAccessibilityChecks(limit = 10, now = new Date()) {
  const db = getPrisma();
  const sources = await db.countyOfficialSource.findMany({
    where: { supersededAt: null, checks: { none: { circuitOpenUntil: { gt: now } } }, registry: { OR: [{ nextReviewAt: null }, { nextReviewAt: { lte: now } }] } },
    include: { registry: true, checks: { orderBy: { checkedAt: "desc" }, take: 1 } },
    orderBy: { effectiveAt: "asc" },
    take: Math.max(1, Math.min(limit, 25)),
  });
  const results = [];
  for (const source of sources) {
    const priorRetry = source.checks[0]?.status === "TEMPORARILY_UNAVAILABLE" ? source.checks[0].retryCount : 0;
    const preliminary = classifyCountyAccessibility(source);
    const mayProbe = source.automationStatus === "PERMITTED" && !source.authenticationRequired && !source.subscriptionRequired && source.robotsStatus?.toLowerCase() !== "prohibited";
    const candidate = source.queryEndpointUrl || source.bulkDataUrl || source.propertySearchUrl || source.parcelGisUrl || source.taxUrl || source.recorderUrl || source.officialDomain;
    const url = safeCountyAccessibilityUrl(candidate);
    let status = preliminary.status;
    let reason = preliminary.reason;
    let httpStatus: number | undefined;
    let responseHash: string | undefined;
    if (!mayProbe) {
      // Persist the policy result without making a network request.
    } else if (!url) {
      status = "NEEDS_REVIEW";
      reason = "The recorded endpoint is not a safe public HTTPS URL.";
    } else {
      try {
        const response = await fetch(url, { method: "HEAD", cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(10_000), headers: { "User-Agent": "DealScoutAI/1.0 county-source-accessibility" } });
        httpStatus = response.status;
        const classified = classifyCountyAccessibility({ ...source, httpStatus });
        status = classified.status;
        reason = classified.reason;
        const adapter = requireReviewedCountyAdapter({ status, adapterVersion: source.adapterVersion, parserVersion: source.parserVersion, hasStructuredEndpoint: Boolean(source.queryEndpointUrl || source.bulkDataUrl) });
        status = adapter.status;
        if (adapter.reason) reason = adapter.reason;
        responseHash = createHash("sha256").update(`${url.origin}${url.pathname}|${response.status}|${response.headers.get("content-type") ?? ""}`).digest("hex");
      } catch {
        const classified = classifyCountyAccessibility({ ...source, networkFailure: true });
        status = classified.status;
        reason = classified.reason;
      }
    }
    const retryCount = status === "TEMPORARILY_UNAVAILABLE" ? Math.min(3, priorRetry + 1) : 0;
    await recordCountySourceCheck({ sourceId: source.id, status, retrievalMethod: "HEAD_ACCESSIBILITY_ONLY", httpStatus, responseHash, failureReason: status === "AUTOMATED" ? undefined : reason, retryCount, checkedAt: now });
    results.push({ sourceId: source.id, fipsCode: source.registry.fipsCode, status, networkRequested: Boolean(url && mayProbe), httpStatus: httpStatus ?? null });
  }
  return { checked: results.length, automated: results.filter((item) => item.status === "AUTOMATED").length, manualVerification: results.filter((item) => item.status !== "AUTOMATED").length, results };
}
