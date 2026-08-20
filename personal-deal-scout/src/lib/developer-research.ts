import "server-only";

import { getPrisma } from "@/lib/prisma";

const PHONE_PATTERN = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
export const DEVELOPER_RESEARCH_VERSION = 2;

function safePublicUrl(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== "https:") throw new Error("Developer research sources must use HTTPS.");
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || /^(127\.|10\.|192\.168\.|169\.254\.)/.test(host)) throw new Error("Private network sources are not allowed.");
  return url;
}

async function fetchPublicPage(raw: string) {
  const url = safePublicUrl(raw);
  const response = await fetch(url, { cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(15_000), headers: { "User-Agent": "DealScoutAI/1.0 public-developer-research", Accept: "text/html,application/xhtml+xml" } });
  if (!response.ok || !(response.headers.get("content-type") || "").includes("text/html")) throw new Error(`Public source returned HTTP ${response.status}.`);
  const html = (await response.text()).slice(0, 2_000_000);
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
  return { finalUrl: response.url || url.toString(), title: html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim(), phones: [...new Set(text.match(PHONE_PATTERN) || [])], emails: [...new Set(text.match(EMAIL_PATTERN) || [])], projects: structuredProjects(html) };
}

type StructuredProject = { name: string; streetAddress: string; city: string; state: string; zipCode: string; organization: string; phone?: string };

function structuredProjects(html: string): StructuredProject[] {
  const projects: StructuredProject[] = [];
  for (const match of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(match[1]) as Record<string, unknown>;
      const entries = Array.isArray(parsed) ? parsed : [parsed];
      for (const entry of entries) {
        if (!entry || typeof entry !== "object") continue;
        const item = entry as Record<string, unknown>;
        if (item["@type"] !== "HomeAndConstructionBusiness") continue;
        const address = item.address as Record<string, unknown> | undefined;
        const parent = item.parentOrganization as Record<string, unknown> | undefined;
        const project = {
          name: typeof item.name === "string" ? item.name.trim() : "",
          streetAddress: typeof address?.streetAddress === "string" ? address.streetAddress.trim() : "",
          city: typeof address?.addressLocality === "string" ? address.addressLocality.trim() : "",
          state: typeof address?.addressRegion === "string" ? address.addressRegion.trim() : "",
          zipCode: typeof address?.postalCode === "string" ? address.postalCode.trim() : "",
          organization: typeof parent?.name === "string" ? parent.name.trim() : "",
          phone: typeof item.telephone === "string" ? item.telephone.trim() : undefined,
        };
        if (project.name && project.streetAddress && project.city && project.state && /^\d{5}$/.test(project.zipCode) && project.organization) projects.push(project);
      }
    } catch { /* Ignore malformed metadata and keep the source unverified. */ }
  }
  return projects;
}

function companyMatchesOrganization(companyName: string, organization: string) {
  const normalize = (value: string) => value.toLowerCase().replace(/\b(llc|inc|corporation|corp|ii|company|co)\b/g, " ").replace(/[^a-z0-9]/g, "");
  const company = normalize(companyName);
  const parent = normalize(organization);
  return company.length >= 5 && parent.length >= 5 && (company.includes(parent) || parent.includes(company));
}

export async function enqueueDeveloperResearch(developerId: string) {
  const db = getPrisma();
  const developer = await db.developer.findUnique({ where: { id: developerId }, select: { id: true, companyName: true, active: true } });
  if (!developer) throw new Error("Developer was not found.");
  if (!developer.active) throw new Error("Inactive developers cannot be queued for research.");
  const existing = await db.developerResearchRun.findFirst({ where: { developerId, status: { in: ["QUEUED", "RUNNING"] } }, orderBy: { startedAt: "desc" } });
  if (existing) return existing;
  const queued = await db.developerResearchRun.create({ data: { developerId, status: "QUEUED", researchVersion: DEVELOPER_RESEARCH_VERSION } });
  await db.auditLog.create({ data: { type: "research.developer_dossier", summary: `Queued automatic public-source research for ${developer.companyName}.`, details: { developerId, runId: queued.id, trigger: "automatic" } } });
  return queued;
}

async function researchDeveloper(developerId: string, runId: string) {
  const db = getPrisma();
  const developer = await db.developer.findUniqueOrThrow({ where: { id: developerId }, include: { projects: true } });
  const run = await db.developerResearchRun.update({ where: { id: runId }, data: { status: "RUNNING", startedAt: new Date(), error: null, researchVersion: DEVELOPER_RESEARCH_VERSION } });
  const urls = [...new Set([developer.website, developer.contactUrl].filter(Boolean) as string[])];
  const errors: string[] = [];
  const pages: Awaited<ReturnType<typeof fetchPublicPage>>[] = [];
  for (const url of urls) {
    try { pages.push(await fetchPublicPage(url)); }
    catch (error) { errors.push(`${url}: ${error instanceof Error ? error.message : "source failed"}`); }
  }
  const publicPhone = pages.flatMap((page) => page.phones)[0];
  const publicEmail = pages.flatMap((page) => page.emails)[0];
  const discoveredProjects = pages.flatMap((page) => page.projects.map((project) => ({ ...project, sourceUrl: page.finalUrl }))).filter((project) => companyMatchesOrganization(developer.companyName, project.organization));
  const verifiedProjects = new Set([
    ...developer.projects.filter((project) => project.sourceUrl && project.verifiedAt).map((project) => `${project.address}|${project.zipCode}`),
    ...discoveredProjects.map((project) => `${project.streetAddress}|${project.zipCode}`),
  ]).size;
  const verifiedWebPresence = pages.some((page) => page.title?.toLowerCase().includes(developer.companyName.toLowerCase().split(/\s+/)[0]));
  const verifiedContact = Boolean(publicPhone || publicEmail);
  const findingsFound = Number(verifiedWebPresence) + Number(verifiedContact) + Number(verifiedProjects > 0);
  const channels = [developer.phone || publicPhone, developer.email || publicEmail, developer.contactUrl].filter(Boolean).length;
  const qualificationStatus = verifiedProjects > 0 && channels >= 2 && developer.contactName ? "PRIORITY" : verifiedProjects > 0 && channels >= 1 ? "QUALIFIED" : verifiedContact ? "LIMITED_CONTACT" : "RESEARCH_NEEDED";
  await db.$transaction(async (tx) => {
    for (const project of discoveredProjects) await tx.developerProject.upsert({
      where: { developerId_address_zipCode: { developerId, address: project.streetAddress, zipCode: project.zipCode } },
      update: { city: project.city, state: project.state, notes: `Official builder page identifies this as the ${project.name} community.`, sourceName: `${project.organization} official website`, sourceUrl: project.sourceUrl, verifiedAt: new Date(), confidence: 90 },
      create: { developerId, address: project.streetAddress, city: project.city, state: project.state, zipCode: project.zipCode, notes: `Official builder page identifies this as the ${project.name} community.`, sourceName: `${project.organization} official website`, sourceUrl: project.sourceUrl, verifiedAt: new Date(), confidence: 90 },
    });
    await tx.developer.update({ where: { id: developerId }, data: { phone: developer.phone || publicPhone || undefined, email: developer.email || publicEmail || undefined, contactUrl: developer.contactUrl || pages[0]?.finalUrl, contactVerifiedAt: verifiedContact ? new Date() : developer.contactVerifiedAt, lastResearchedAt: new Date(), qualificationStatus } });
    const operationallyReady = verifiedWebPresence && (verifiedContact || verifiedProjects > 0);
    await tx.developerResearchRun.update({ where: { id: run.id }, data: { status: operationallyReady ? "COMPLETE" : "NEEDS_MANUAL_VERIFICATION", sourcesChecked: pages.length, findingsFound, manualNeeded: 3 - findingsFound, error: errors.length ? errors.join("\n").slice(0, 4000) : null, finishedAt: new Date() } });
    await tx.auditLog.create({ data: { type: "research.developer_dossier", summary: `Researched ${developer.companyName}; ${findingsFound} of 3 evidence categories verified.`, details: { developerId, runId: run.id, sourcesChecked: pages.length, verifiedWebPresence, verifiedContact, verifiedProjects } } });
  });
  return { findingsFound, manualNeeded: 3 - findingsFound };
}

export async function runQueuedDeveloperResearch(runId: string) {
  const db = getPrisma();
  const run = await db.developerResearchRun.findUnique({ where: { id: runId } });
  if (!run || run.status !== "QUEUED") return { status: "skipped" as const };
  try { return { status: "completed" as const, developerId: run.developerId, ...await researchDeveloper(run.developerId, run.id) }; }
  catch (error) {
    const message = error instanceof Error ? error.message : "Automatic developer research failed.";
    await db.developerResearchRun.updateMany({ where: { id: run.id, status: { in: ["QUEUED", "RUNNING"] } }, data: { status: "FAILED", error: message.slice(0, 4000), finishedAt: new Date() } });
    return { status: "failed" as const, developerId: run.developerId, error: message };
  }
}

export async function runAutomaticDeveloperResearchBatch(limit = 5) {
  const db = getPrisma();
  const safeLimit = Math.max(1, Math.min(limit, 25));
  const staleCutoff = new Date(Date.now() - 7 * 24 * 60 * 60_000);
  const abandonedCutoff = new Date(Date.now() - 30 * 60_000);
  await db.developerResearchRun.updateMany({ where: { status: "RUNNING", startedAt: { lt: abandonedCutoff } }, data: { status: "QUEUED", error: "Recovered an interrupted automatic developer research run." } });
  const stale = await db.developer.findMany({ where: { active: true, researchRuns: { none: { status: { in: ["QUEUED", "RUNNING"] } } }, OR: [{ researchRuns: { none: { researchVersion: { gte: DEVELOPER_RESEARCH_VERSION } } } }, { lastResearchedAt: null }, { lastResearchedAt: { lt: staleCutoff } }] }, select: { id: true }, orderBy: { updatedAt: "asc" }, take: safeLimit * 2 });
  for (const developer of stale) await enqueueDeveloperResearch(developer.id);
  const queued = await db.developerResearchRun.findMany({ where: { status: "QUEUED", developer: { active: true } }, orderBy: { startedAt: "asc" }, take: safeLimit });
  const results: Awaited<ReturnType<typeof runQueuedDeveloperResearch>>[] = [];
  for (let index = 0; index < queued.length; index += 5) results.push(...await Promise.all(queued.slice(index, index + 5).map((run) => runQueuedDeveloperResearch(run.id))));
  return { processed: results.length, completed: results.filter((result) => result.status === "completed").length, failed: results.filter((result) => result.status === "failed").length, results };
}

export const __developerResearchTestables = { safePublicUrl, structuredProjects, companyMatchesOrganization };
