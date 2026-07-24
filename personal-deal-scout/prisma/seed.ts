import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.systemSetting.upsert({ where: { id: "singleton" }, update: { mode: "RESEARCH" }, create: { id: "singleton", mode: "RESEARCH" } });
  for (const provider of ["SMS", "EMAIL", "VOICE"]) {
    await prisma.providerSetting.upsert({ where: { provider }, update: { enabled: false, configured: false }, create: { provider, enabled: false, configured: false } });
  }
  await prisma.messageTemplate.upsert({
    where: { type_channel: { type: "Seller introduction", channel: "SMS" } },
    update: {},
    create: { type: "Seller introduction", channel: "SMS", body: "Hi [OWNER], I am researching the property at [PROPERTY]. Would you be open to a conversation?" },
  });
  await prisma.auditLog.create({ data: { type: "database.migrated", summary: "Seeded production-safe defaults.", details: { systemMode: "RESEARCH", providersEnabled: false } } });
}

main().finally(() => prisma.$disconnect());
