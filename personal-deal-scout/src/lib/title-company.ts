import "server-only";
import { Prisma, type TitleOpeningStatus } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";
import { appendAuditEvent } from "@/lib/transaction-control";

export async function ensureTitleCompanyCandidates() {
  const db = getPrisma();
  const candidates = [
    { name: "Independence Title", website: "https://www.independencetitle.com/", serviceAreas: ["Texas - coverage to confirm"], notes: "Statewide candidate. All closing capabilities remain unverified until confirmed directly." },
    { name: "Cottonwood Title & Escrow", website: "https://cottonwoodtc.com/", serviceAreas: ["Texas investor transactions - coverage to confirm"], notes: "Investor-specialist candidate. Assignment, double-close, and funding capabilities remain unverified until confirmed directly." },
    { name: "True North Title & Escrow", website: "https://www.truenorthtitleandescrow.com/", serviceAreas: ["Texas counties to confirm"], notes: "Investor-network candidate. Capabilities remain unverified until confirmed directly." },
  ];
  await Promise.all(candidates.map((candidate) => db.titleCompany.upsert({ where: { name: candidate.name }, update: {}, create: { ...candidate, counties: [], requiredDocuments: [], status: "UNCONTACTED", priority: "UNASSIGNED" } })));
}

export async function readTitleNetwork() {
  await ensureTitleCompanyCandidates();
  return getPrisma().titleCompany.findMany({ include: { contacts: { orderBy: [{ primary: "desc" }, { name: "asc" }] }, openings: { include: { transaction: { include: { property: true } } }, orderBy: { updatedAt: "desc" }, take: 5 } }, orderBy: [{ priority: "asc" }, { name: "asc" }] });
}

export async function openTitle(input: { transactionId: string; titleCompanyId: string; targetCloseAt?: Date; earnestMoneyDueAt?: Date; notes?: string; actor: string }) {
  return getPrisma().$transaction(async (tx) => {
    const [transaction, company] = await Promise.all([tx.dealTransaction.findUnique({ where: { id: input.transactionId } }), tx.titleCompany.findUnique({ where: { id: input.titleCompanyId } })]);
    if (!transaction || !company) throw new Error("Transaction or title company not found.");
    if (transaction.controlStatus === "STOPPED") throw new Error("A stopped transaction cannot be opened with title.");
    const { actor, ...data } = input;
    const opening = await tx.titleOpening.create({ data: { ...data, createdBy: actor, requirements: company.requiredDocuments, status: "PREPARING" } });
    await appendAuditEvent(tx, input.transactionId, "title.opening.prepared", input.actor, `Prepared title opening with ${company.name}.`, { titleOpeningId: opening.id } as Prisma.InputJsonValue);
    return opening;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function updateTitleOpening(input: { id: string; status: TitleOpeningStatus; fileNumber?: string; escrowOfficer?: string; notes?: string; actor: string }) {
  return getPrisma().$transaction(async (tx) => {
    const current = await tx.titleOpening.findUnique({ where: { id: input.id }, include: { titleCompany: true } });
    if (!current) throw new Error("Title opening not found.");
    const opening = await tx.titleOpening.update({ where: { id: input.id }, data: { status: input.status, fileNumber: input.fileNumber || current.fileNumber, escrowOfficer: input.escrowOfficer || current.escrowOfficer, notes: input.notes || current.notes, openedAt: input.status === "OPENED" && !current.openedAt ? new Date() : current.openedAt } });
    await appendAuditEvent(tx, opening.transactionId, "title.opening.updated", input.actor, `${current.titleCompany.name} title file moved to ${input.status.replaceAll("_", " ")}.`, { titleOpeningId: opening.id } as Prisma.InputJsonValue);
    return opening;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
