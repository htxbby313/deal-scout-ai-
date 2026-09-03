import "server-only";

import {
  csvMarkets,
  DEFAULT_COMPANY_NAME,
  type OwnerProfile,
} from "@/lib/owner-profile";
import { getPrisma } from "@/lib/prisma";

export async function getOwnerProfile(): Promise<OwnerProfile> {
  const setting = await getPrisma().systemSetting.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton", mode: "RESEARCH" },
  });
  return {
    displayName: setting.ownerDisplayName?.trim() ?? "",
    companyName: setting.companyName?.trim() || DEFAULT_COMPANY_NAME,
    phone: setting.ownerPhone?.trim() ?? "",
    email: setting.ownerEmail?.trim() ?? "",
    markets: setting.markets,
  };
}

export async function saveOwnerProfile(input: {
  displayName: string;
  companyName: string;
  phone: string;
  email: string;
  markets: string;
}) {
  const companyName = input.companyName.trim() || DEFAULT_COMPANY_NAME;
  await getPrisma().systemSetting.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      mode: "RESEARCH",
      ownerDisplayName: input.displayName.trim() || null,
      companyName,
      ownerPhone: input.phone.trim() || null,
      ownerEmail: input.email.trim() || null,
      markets: csvMarkets(input.markets),
    },
    update: {
      ownerDisplayName: input.displayName.trim() || null,
      companyName,
      ownerPhone: input.phone.trim() || null,
      ownerEmail: input.email.trim() || null,
      markets: csvMarkets(input.markets),
    },
  });
}
