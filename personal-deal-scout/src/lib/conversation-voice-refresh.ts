import "server-only";
import { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";
import { conversationVoice, refreshLegacyIntroduction } from "@/lib/conversation-voice";

// Refresh only untouched, unapproved legacy introductions. Never send or approve.
export async function refreshPendingConversationVoice() {
  const db = getPrisma();
  const deadlineAt = Date.now() + 10_000;
  let refreshed = 0;
  for (const kind of ["buyer", "seller"] as const) {
    let cursor: string | undefined;
    while (true) {
      const paging = { orderBy: { id: "asc" as const }, take: 50, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) };
      const rows = kind === "buyer"
        ? (await db.messageApproval.findMany({ ...paging, where: { status: "PENDING", provider: "disabled", body: { contains: "I’m Cole with Coleman & Co. Holdings LLC." }, subject: { startsWith: "Acquisitions relationship:" } }, select: { id: true, body: true } }))
        : (await db.sellerEngagement.findMany({ ...paging, where: { status: { in: ["DRAFT", "BLOCKED", "READY_FOR_OWNER_REVIEW"] }, ownerApprovedAt: null, completedAt: null, contactAttempts: { none: {} }, conversations: { none: {} }, transaction: { controlStatus: { not: "STOPPED" } }, purpose: { contains: "this is Cole with Coleman & Co. Holdings LLC." } }, select: { id: true, purpose: true } })).map((row) => ({ id: row.id, body: row.purpose }));
      if (!rows.length) break;
      for (const row of rows) {
        if (Date.now() >= deadlineAt) return { refreshed, voiceVersion: conversationVoice.version, moreWorkPossible: true };
        const body = refreshLegacyIntroduction(row.body);
        if (!body) continue;
        refreshed += await db.$transaction(async (tx) => {
          const result = kind === "buyer"
            ? await tx.messageApproval.updateMany({ where: { id: row.id, status: "PENDING", provider: "disabled", body: row.body }, data: { body } })
            : await tx.sellerEngagement.updateMany({ where: { id: row.id, purpose: row.body, ownerApprovedAt: null, completedAt: null, status: { in: ["DRAFT", "BLOCKED", "READY_FOR_OWNER_REVIEW"] }, contactAttempts: { none: {} }, conversations: { none: {} }, transaction: { controlStatus: { not: "STOPPED" } } }, data: { purpose: body } });
          if (result.count) await tx.auditLog.create({ data: { type: "conversation.draft.voice_refreshed", summary: "Refreshed an unapproved system introduction using Tay's inquiry-first voice. Nothing sent.", details: { kind, draftId: row.id, version: conversationVoice.version, previousBody: row.body, revisedBody: body } } });
          return result.count;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      }
      cursor = rows.at(-1)!.id;
      if (rows.length < 50) break;
    }
  }
  return { refreshed, voiceVersion: conversationVoice.version, moreWorkPossible: false };
}
