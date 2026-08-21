import "server-only";
import { z } from "zod";

import { getPrisma } from "@/lib/prisma";
import { chunkedMap, fetchWithRetry, htmlToText, stableUnique, stableUniqueBy } from "@/lib/research-runtime";

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
  const response = await fetchWithRetry(url, { cache: "no-store", redirect: "follow", attempts: 3, timeoutMs: 15_000, headers: { "User-Agent": "DealScoutAI/1.0 public-developer-research", Accept: "text/html,application/xhtml+xml" } });
  if (!response.ok || !(response.headers.get("content-type") || "").includes("text/html")) throw new Error(`Public source returned HTTP ${response.status}.`);
  if (Number(response.headers.get("content-length") || 0) > 2_000_000) throw new Error("Public source exceeded the 2 MB research limit.");
  const html = (await response.text()).slice(0, 2_000_000);
  const text = htmlToText(html);
  return { finalUrl: response.url || url.toString(), title: html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim(), phones: stableUnique(text.match(PHONE_PATTERN) || []), emails: stableUnique(text.match(EMAIL_PATTERN) || []), projects: structuredProjects(html) };
}

type StructuredProject = { name: string; streetAddress: string; city: string; state: string; zipCode: string; organization: string; phone?: string };
const structuredProjectSchema = z.object({ "@type": z.literal("HomeAndConstructionBusiness"), name: z.string().trim().min(1), address: z.object({ streetAddress: z.string().trim().min(1), addressLocality: z.string().trim().min(1), addressRegion: z.string().trim().min(2), postalCode: z.string().trim().regex(/^\d{5}$/) }), parentOrganization: z.object({ name: z.string().trim().min(1) }), telephone: z.string().trim().optional() });

function structuredProjects(html: string): StructuredProject[] {
  const projects: StructuredProject[] = [];
  for (const match of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(match[1]) as Record<string, unknown>;
      const entries = Array.isArray(parsed) ? parsed : [parsed];
      for (const entry of entries) {
        if (!entry || typeof entry !== "object") continue;
        const validation = structuredProjectSchema.safeParse(entry);
        if (!validation.success) continue;
        const item = validation.data;
        const address = item.address;
        const parent = item.parentOrganization;
        const project = {
          name: item.name, streetAddress: address.streetAddress, city: address.addressLocality, state: address.addressRegion, zipCode: address.postalCode, organization: parent.name, phone: item.telephone,
        };
        projects.push(project);
      }
    } catch { /* Ignore malformed metadata and keep the source unverified. */ }
  }
  return stableUniqueBy(projects, (project) => `${project.streetAddress.toLowerCase()}|${project.zipCode}`).slice(0, 100);
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

export async function enqueueDeveloperResearchBatch(developerIds: string[]) {
  const ids = stableUnique(developerIds).slice(0, 1000);
  if (!ids.length) return [];
  const db = getPrisma();
  return db.$transaction(async (tx) => {
    const [developers, active] = await Promise.all([
      tx.developer.findMany({ where: { id: { in: ids }, active: true }, select: { id: true, companyName: true } }),
      tx.developerResearchRun.findMany({ where: { developerId: { in: ids }, status: { in: ["QUEUED", "RUNNING"] } }, select: { developerId: true } }),
    ]);
    const activeIds = new Set(active.map((run) => run.developerId));
    const queuedDevelopers = developers.filter((developer) => !activeIds.has(developer.id));
    const runs = await tx.developerResearchRun.createManyAndReturn({ data: queuedDevelopers.map((developer) => ({ developerId: developer.id, status: "QUEUED", researchVersion: DEVELOPER_RESEARCH_VERSION })), select: { id: true, developerId: true } });
    const names = new Map(queuedDevelopers.map((developer) => [developer.id, developer.companyName]));
    if (runs.length) await tx.auditLog.createMany({ data: runs.map((run) => ({ type: "research.developer_dossier", summary: `Queued automatic public-source research for ${names.get(run.developerId) ?? "developer"}.`, details: { developerId: run.developerId, runId: run.id, trigger: "automatic_batch" } })) });
    return runs;
  });
}

async function researchDeveloper(developerId: string, runId: string) {
  const db = getPrisma();
  const developer = await db.developer.findUniqueOrThrow({ where: { id: developerId }, include: { projects: true } });
  const run = await db.developerResearchRun.update({ where: { id: runId }, data: { status: "RUNNING", startedAt: new Date(), error: null, researchVersion: DEVELOPER_RESEARCH_VERSION } });
  const urls = stableUnique([developer.website, developer.contactUrl].filter(Boolean) as string[]);
  const errors: string[] = [];
  const pages: Awaited<ReturnType<typeof fetchPublicPage>>[] = [];
  const pageResults = await chunkedMap(urls, 2, async (url) => {
    try { return { page: await fetchPublicPage(url), error: null }; }
    catch (error) { return { page: null, error: `${url}: ${error instanceof Error ? error.message : "source failed"}` }; }
  });
  for (const result of pageResults) { if (result.page) pages.push(result.page); if (result.error) errors.push(result.error); }
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
    await chunkedMap(discoveredProjects, 20, (project) => tx.developerProject.upsert({
      where: { developerId_address_zipCode: { developerId, address: project.streetAddress, zipCode: project.zipCode } },
      update: { city: project.city, state: project.state, notes: `Official builder page identifies this as the ${project.name} community.`, sourceName: `${project.organization} official website`, sourceUrl: project.sourceUrl, verifiedAt: new Date(), confidence: 90 },
      create: { developerId, address: project.streetAddress, city: project.city, state: project.state, zipCode: project.zipCode, notes: `Official builder page identifies this as the ${project.name} community.`, sourceName: `${project.organization} official website`, sourceUrl: project.sourceUrl, verifiedAt: new Date(), confidence: 90 },
    }));
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
  await enqueueDeveloperResearchBatch(stale.map((developer) => developer.id));
  const queued = await db.developerResearchRun.findMany({ where: { status: "QUEUED", developer: { active: true } }, orderBy: { startedAt: "asc" }, take: safeLimit });
  const results = await chunkedMap(queued, 5, (run) => runQueuedDeveloperResearch(run.id));
  return { processed: results.length, completed: results.filter((result) => result.status === "completed").length, failed: results.filter((result) => result.status === "failed").length, results };
}

export const __developerResearchTestables = { safePublicUrl, structuredProjectSchema, structuredProjects, companyMatchesOrganization };
