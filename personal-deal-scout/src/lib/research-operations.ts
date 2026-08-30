import "server-only";

import { getPrisma } from "@/lib/prisma";
import { enqueueDeveloperResearchBatch } from "@/lib/developer-research";
import { enqueuePropertyResearchBatch } from "@/lib/property-research";
import { researchPriorityScore } from "@/lib/domain";

const priorityFields = {
  id: true,
  opportunityStatus: true,
  confidence: true,
  sourceUrl: true,
  verificationSourceUrl: true,
  verificationDate: true,
  estimatedValue: true,
  contactPhone: true,
  contactEmail: true,
  contactUrl: true,
} as const;

export async function readResearchOperations() {
  const db = getPrisma();
  const [properties, developers, events] = await Promise.all([
    db.property.findMany({
      where: { opportunityStatus: { not: "REJECTED" } },
      select: { ...priorityFields, address: true, city: true, state: true, researchRuns: { orderBy: { startedAt: "desc" }, take: 1 } },
    }),
    db.developer.findMany({
      where: { active: true },
      select: { id: true, companyName: true, researchRuns: { orderBy: { startedAt: "desc" }, take: 1 } },
      orderBy: { updatedAt: "desc" },
    }),
    db.auditLog.findMany({ where: { type: { in: ["research.property_dossier", "research.developer_dossier"] } }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  properties.sort((a, b) => researchPriorityScore(b) - researchPriorityScore(a) || a.address.localeCompare(b.address));
  return { properties, developers, events };
}

export async function enqueueResearchBacklog() {
  const db = getPrisma();
  const pageSize = 1000;
  let properties = 0; let developers = 0;
  let propertyPage = await db.property.findMany({ where: { opportunityStatus: { not: "REJECTED" } }, select: { id: true }, orderBy: { id: "asc" }, take: pageSize });
  while (propertyPage.length) {
    const cursor = propertyPage.at(-1)?.id;
    const nextPage = propertyPage.length === pageSize && cursor
      ? db.property.findMany({ where: { opportunityStatus: { not: "REJECTED" } }, select: { id: true }, orderBy: { id: "asc" }, take: pageSize, cursor: { id: cursor }, skip: 1 })
      : Promise.resolve([]);
    properties += (await enqueuePropertyResearchBatch(propertyPage.map(({ id }) => id))).length;
    propertyPage = await nextPage;
  }
  let developerPage = await db.developer.findMany({ where: { active: true }, select: { id: true }, orderBy: { id: "asc" }, take: pageSize });
  while (developerPage.length) {
    const cursor = developerPage.at(-1)?.id;
    const nextPage = developerPage.length === pageSize && cursor
      ? db.developer.findMany({ where: { active: true }, select: { id: true }, orderBy: { id: "asc" }, take: pageSize, cursor: { id: cursor }, skip: 1 })
      : Promise.resolve([]);
    developers += (await enqueueDeveloperResearchBatch(developerPage.map(({ id }) => id))).length;
    developerPage = await nextPage;
  }
  return { properties, developers };
}
