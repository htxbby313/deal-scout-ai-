import "server-only";

import { Prisma } from "@prisma/client";

import {
  BUY_BOX_BLOCKER_CODE,
  BUY_BOX_MATCH_CAP,
  BUY_BOX_SCAN_BOX_CAP,
  parseBuyBoxPrompt,
  selectBuyBoxMatches,
  type BuyBoxCriteria,
} from "@/lib/buy-box";
import { getPrisma } from "@/lib/prisma";

const csv = (value: string) =>
  value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

export function criteriaFromForm(input: {
  name: string;
  prompt: string;
  states: string;
  cities: string;
  zipCodes: string;
  propertyTypes: string;
  minPrice: string;
  maxPrice: string;
  minSpread: string;
}): BuyBoxCriteria {
  const parsed = input.prompt ? parseBuyBoxPrompt(input.prompt) : parseBuyBoxPrompt(input.name);
  const dollars = (raw: string) => {
    const amount = Number(raw.replaceAll(",", ""));
    if (!Number.isFinite(amount) || amount <= 0) return null;
    return BigInt(Math.round(amount * 100));
  };
  const listed = (manual: string[], fallback: string[]) =>
    manual.length ? manual : fallback;
  return {
    name: input.name.trim() || parsed.name,
    naturalLanguage: input.prompt.trim() || parsed.naturalLanguage,
    states: listed(
      csv(input.states).map((state) => state.toUpperCase()),
      parsed.states,
    ),
    cities: listed(csv(input.cities), parsed.cities),
    counties: parsed.counties,
    zipCodes: listed(csv(input.zipCodes), parsed.zipCodes),
    propertyTypes: listed(csv(input.propertyTypes), parsed.propertyTypes),
    minPriceCents: dollars(input.minPrice) ?? parsed.minPriceCents,
    maxPriceCents: dollars(input.maxPrice) ?? parsed.maxPriceCents,
    minSpreadCents: dollars(input.minSpread) ?? parsed.minSpreadCents,
    maxRepairCents: parsed.maxRepairCents,
  };
}

export async function listBuyBoxes() {
  return getPrisma().buyOperatorPreference.findMany({
    where: { ownerId: "owner" },
    orderBy: { updatedAt: "desc" },
  });
}

export async function saveBuyBox(criteria: BuyBoxCriteria) {
  const db = getPrisma();
  return db.buyOperatorPreference.create({
    data: {
      ownerId: "owner",
      name: criteria.name,
      active: true,
      naturalLanguage: criteria.naturalLanguage,
      states: criteria.states,
      cities: criteria.cities,
      counties: criteria.counties,
      zipCodes: criteria.zipCodes,
      propertyTypes: criteria.propertyTypes,
      minPriceCents: criteria.minPriceCents,
      maxPriceCents: criteria.maxPriceCents,
      minSpreadCents: criteria.minSpreadCents,
      maxRepairCents: criteria.maxRepairCents,
    },
  });
}

export async function applyBuyBox(buyBoxId: string) {
  const db = getPrisma();
  const box = await db.buyOperatorPreference.findUnique({ where: { id: buyBoxId } });
  if (!box || !box.active) throw new Error("Buy Box not found.");
  const properties = await db.property.findMany({
    select: {
      id: true,
      address: true,
      city: true,
      state: true,
      zipCode: true,
      county: true,
      propertyType: true,
      estimatedValue: true,
    },
    take: 500,
  });
  const matches = selectBuyBoxMatches(properties, box);
  const attached: { propertyId: string; address: string }[] = [];
  for (const property of matches.slice(0, BUY_BOX_MATCH_CAP)) {
    await attachBuyBoxMatch({
      propertyId: property.id,
      address: property.address,
      buyBoxId: box.id,
      buyBoxName: box.name,
    });
    attached.push({ propertyId: property.id, address: property.address });
  }
  return { attached, unmatched: matches.length === 0 };
}

/** Cached properties only. Never paid enrichment. Caps boxes and matches. */
export async function scanActiveBuyBoxes() {
  const boxes = await getPrisma().buyOperatorPreference.findMany({
    where: { ownerId: "owner", active: true },
    orderBy: { updatedAt: "desc" },
    take: BUY_BOX_SCAN_BOX_CAP,
  });
  const results = [];
  for (const box of boxes) {
    results.push({
      buyBoxId: box.id,
      name: box.name,
      ...(await applyBuyBox(box.id)),
    });
  }
  return {
    scanned: boxes.length,
    attachedCount: results.reduce((sum, item) => sum + item.attached.length, 0),
    results,
  };
}

async function attachBuyBoxMatch(input: {
  propertyId: string;
  address: string;
  buyBoxId: string;
  buyBoxName: string;
}) {
  const db = getPrisma();
  await db.$transaction(async (tx) => {
    let funnel = await tx.acquisitionFunnel.findFirst({
      where: { propertyId: input.propertyId },
      orderBy: { createdAt: "desc" },
    });
    if (!funnel) {
      funnel = await tx.acquisitionFunnel.create({
        data: {
          propertyId: input.propertyId,
          stage: "DISCOVERED",
          responsibleActor: "owner",
          nextReviewAt: new Date(Date.now() + 7 * 86_400_000),
          expiresAt: new Date(Date.now() + 7 * 86_400_000),
        },
      });
      await tx.acquisitionStageHistory.create({
        data: {
          funnelId: funnel.id,
          sequence: 1,
          toStage: "DISCOVERED",
          actor: "owner",
          reason: `Buy Box "${input.buyBoxName}" matched this property from cached records.`,
          evidence: { buyBoxId: input.buyBoxId, propertyId: input.propertyId },
        },
      });
    }
    const existing = await tx.acquisitionFunnelBlocker.findFirst({
      where: {
        funnelId: funnel.id,
        code: BUY_BOX_BLOCKER_CODE,
        status: "OPEN",
      },
    });
    if (existing) return;
    await tx.acquisitionFunnelBlocker.create({
      data: {
        funnelId: funnel.id,
        code: BUY_BOX_BLOCKER_CODE,
        explanation: `Matches Buy Box "${input.buyBoxName}". Review on Deal Box. No paid enrichment was run.`,
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
