import "server-only";

import { getPrisma } from "@/lib/prisma";

const CARD_IMAGE_PATH = "/api/property-card-image";
const AUTOMATIC_MEDIA_POSITION = 10_000;
const AUTOMATIC_SOURCE = "Google Street View";
const AUTOMATIC_CAPTION = "Automatic property card image";

function normalizedOrigin(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== "https:") throw new Error("Property card media requires HTTPS.");
  return url.origin;
}

function canonicalOrigin(fallbackOrigin: string) {
  const configured = process.env.DEAL_SCOUT_CANONICAL_ORIGIN?.trim();
  if (configured) return normalizedOrigin(configured);
  const vercelProductionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProductionHost)
    return normalizedOrigin(`https://${vercelProductionHost}`);
  return normalizedOrigin(fallbackOrigin);
}

export async function ensureAutomaticPropertyCardMedia(origin: string, limit = 100) {
  const db = getPrisma();
  const safeOrigin = canonicalOrigin(origin);
  const properties = await db.property.findMany({
    where: {
      opportunityStatus: { not: "REJECTED" },
      OR: [
        { media: { none: {} } },
        {
          media: {
            some: { sourceName: AUTOMATIC_SOURCE, caption: AUTOMATIC_CAPTION },
          },
        },
      ],
    },
    select: {
      id: true,
      address: true,
      city: true,
      state: true,
      zipCode: true,
      media: {
        where: { sourceName: AUTOMATIC_SOURCE, caption: AUTOMATIC_CAPTION },
        orderBy: { discoveredAt: "asc" },
        take: 1,
        select: { id: true },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: Math.max(1, Math.min(limit, 250)),
  });

  let created = 0;
  let updated = 0;
  for (const property of properties) {
    const url = `${safeOrigin}${CARD_IMAGE_PATH}?propertyId=${encodeURIComponent(property.id)}`;
    const address = `${property.address}, ${property.city}, ${property.state} ${property.zipCode}`;
    const automaticMedia = property.media[0];
    const data = {
        altText: `Automatically verified exterior image for ${address}`,
        caption: AUTOMATIC_CAPTION,
        sourceName: AUTOMATIC_SOURCE,
        sourceUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
        kind: "MAP",
        position: AUTOMATIC_MEDIA_POSITION,
        rightsStatus: "INTERNAL_ONLY",
        sendApproved: false,
      } as const;
    if (automaticMedia) {
      await db.propertyMedia.update({
        where: { id: automaticMedia.id },
        data: { ...data, url },
      });
      updated += 1;
    } else {
      await db.propertyMedia.create({
        data: { propertyId: property.id, url, ...data },
      });
      created += 1;
    }
  }

  return { checked: properties.length, created, updated };
}
