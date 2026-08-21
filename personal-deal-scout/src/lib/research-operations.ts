import "server-only";

import { getPrisma } from "@/lib/prisma";
import { enqueueDeveloperResearchBatch } from "@/lib/developer-research";
import { enqueuePropertyResearchBatch } from "@/lib/property-research";

export async function readResearchOperations() {
  const db = getPrisma();
  const [properties, developers, events] = await Promise.all([
    db.property.findMany({
      where: { opportunityStatus: { not: "REJECTED" } },
      select: { id: true, address: true, city: true, state: true, researchRuns: { orderBy: { startedAt: "desc" }, take: 1 } },
      orderBy: { updatedAt: "desc" },
    }),
    db.developer.findMany({
      where: { active: true },
      select: { id: true, companyName: true, researchRuns: { orderBy: { startedAt: "desc" }, take: 1 } },
      orderBy: { updatedAt: "desc" },
    }),
    db.auditLog.findMany({ where: { type: { in: ["research.property_dossier", "research.developer_dossier"] } }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  return { properties, developers, events };
}

export async function enqueueResearchBacklog() {
  const db = getPrisma();
  const [properties, developers] = await Promise.all([
    db.property.findMany({ where: { opportunityStatus: { not: "REJECTED" } }, select: { id: true } }),
    db.developer.findMany({ where: { active: true }, select: { id: true } }),
  ]);
  const [propertyRuns, developerRuns] = await Promise.all([
    enqueuePropertyResearchBatch(properties.map(({ id }) => id)),
    enqueueDeveloperResearchBatch(developers.map(({ id }) => id)),
  ]);
  return { properties: propertyRuns.length, developers: developerRuns.length };
}
