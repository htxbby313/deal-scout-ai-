import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.systemSetting.upsert({ where: { id: "singleton" }, update: { mode: "RESEARCH" }, create: { id: "singleton", mode: "RESEARCH" } });
  const agents = [
    ["Operations Coordinator", "OPERATIONS_COORDINATOR", "Coordinates internal queues, evidence handoffs, and owner review."],
    ["Research Agent", "RESEARCH", "Collects and verifies lawful public-source research."],
    ["Seller Acquisition Agent", "SELLER_ACQUISITION", "Prepares seller work for owner approval without autonomous outreach."],
    ["Buyer & Developer Agent", "BUYER_DEVELOPER", "Maintains verified buyer demand, pricing, and coverage."],
    ["Transaction & Compliance Agent", "TRANSACTION_COMPLIANCE", "Checks transaction controls, evidence, and compliance gates."],
  ] as const;
  for (const [name, role, description] of agents) {
    await prisma.agent.upsert({
      where: { role },
      update: { name, description, status: "ACTIVE", autonomousOutbound: false },
      create: { name, role, description, status: "ACTIVE", autonomyMode: "LOCKED", autonomousOutbound: false },
    });
  }
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
