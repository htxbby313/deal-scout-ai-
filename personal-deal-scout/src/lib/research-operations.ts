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
  let properties = 0; let developers = 0;
  let propertyCursor: string | undefined; let developerCursor: string | undefined;
  while (true) {
    const page = await db.property.findMany({ where: { opportunityStatus: { not: "REJECTED" } }, select: { id: true }, orderBy: { id: "asc" }, take: 1000, ...(propertyCursor ? { cursor: { id: propertyCursor }, skip: 1 } : {}) });
    if (!page.length) break;
    properties += (await enqueuePropertyResearchBatch(page.map(({ id }) => id))).length;
    propertyCursor = page.at(-1)?.id;
    if (page.length < 1000) break;
  }
  while (true) {
    const page = await db.developer.findMany({ where: { active: true }, select: { id: true }, orderBy: { id: "asc" }, take: 1000, ...(developerCursor ? { cursor: { id: developerCursor }, skip: 1 } : {}) });
    if (!page.length) break;
    developers += (await enqueueDeveloperResearchBatch(page.map(({ id }) => id))).length;
    developerCursor = page.at(-1)?.id;
    if (page.length < 1000) break;
  }
  return { properties, developers };
}
