import "server-only";

import { getPrisma } from "@/lib/prisma";

const CARD_IMAGE_PATH = "/api/property-card-image";

function normalizedOrigin(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== "https:") throw new Error("Property card media requires HTTPS.");
  return url.origin;
}

export async function ensureAutomaticPropertyCardMedia(origin: string, limit = 100) {
  const db = getPrisma();
  const safeOrigin = normalizedOrigin(origin);
  const properties = await db.property.findMany({
    where: {
      opportunityStatus: { not: "REJECTED" },
      media: { none: {} },
    },
    select: {
      id: true,
      address: true,
      city: true,
      state: true,
      zipCode: true,
    },
    orderBy: { updatedAt: "desc" },
    take: Math.max(1, Math.min(limit, 250)),
  });

  let created = 0;
  for (const property of properties) {
    const url = `${safeOrigin}${CARD_IMAGE_PATH}?propertyId=${encodeURIComponent(property.id)}`;
    const address = `${property.address}, ${property.city}, ${property.state} ${property.zipCode}`;
    await db.propertyMedia.upsert({
      where: { propertyId_url: { propertyId: property.id, url } },
      update: {
        altText: `Automatically verified exterior image for ${address}`,
        caption: "Automatic property card image",
        sourceName: "Google Street View",
        sourceUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
        kind: "MAP",
        position: -100,
        rightsStatus: "INTERNAL_ONLY",
        sendApproved: false,
      },
      create: {
        propertyId: property.id,
        url,
        altText: `Automatically verified exterior image for ${address}`,
        caption: "Automatic property card image",
        sourceName: "Google Street View",
        sourceUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
        kind: "MAP",
        position: -100,
        rightsStatus: "INTERNAL_ONLY",
        sendApproved: false,
      },
    });
    created += 1;
  }

  return { checked: properties.length, created };
}
