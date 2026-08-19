import "server-only";

import { Prisma, type AgentRole } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";
import { AGENT_TASK_TYPES, evaluateAgentTask, type AgentTaskType } from "@/lib/agent-workflow-policy";
import { researchProperty } from "@/lib/property-research";
import { enqueueDeveloperResearch, runQueuedDeveloperResearch } from "@/lib/developer-research";
import { scoreDeveloperMatches } from "@/lib/database";
import { agentTaskDedupeKey } from "@/lib/agent-task-dedup";

const TEAM: Array<{ role: AgentRole; name: string; description: string }> = [
  { role: "OPERATIONS_COORDINATOR", name: "Operations Coordinator", description: "Coordinates evidence-backed work and owner handoffs." },
  { role: "RESEARCH", name: "Research Agent", description: "Refreshes public-source property and developer evidence." },
  { role: "SELLER_ACQUISITION", name: "Seller Acquisition Agent", description: "Assesses objective seller and transaction fit without contacting anyone." },
  { role: "BUYER_DEVELOPER", name: "Buyer and Developer Agent", description: "Matches verified buyers to documented opportunities." },
  { role: "TRANSACTION_COMPLIANCE", name: "Transaction Compliance Agent", description: "Builds internal checklists and blocks unsupported progression." },
];
const activeTaskStatuses = ["QUEUED", "IN_PROGRESS", "WAITING_FOR_APPROVAL"] as const;

export async function ensureAgentTeam() {
  const db = getPrisma();
  await Promise.all(TEAM.map((member) => db.agent.upsert({ where: { role: member.role }, update: { name: member.name, description: member.description }, create: member })));
  return db.agent.findMany({ orderBy: { role: "asc" } });
}

async function createTaskIfMissing(input: { role: AgentRole; taskType: AgentTaskType; title: string; description: string; transactionId?: string; propertyId?: string; developerId?: string; evidenceCount?: number; ownerApprovalRequired?: boolean }) {
  const db = getPrisma();
  const agent = await db.agent.findUniqueOrThrow({ where: { role: input.role } });
  const dedupeKey = agentTaskDedupeKey({ agentId: agent.id, taskType: input.taskType, transactionId: input.transactionId, propertyId: input.propertyId, developerId: input.developerId });
  const recentCutoff = new Date(Date.now() - 24 * 60 * 60_000);
  const existing = await db.agentTask.findFirst({ where: { assignedAgentId: agent.id, taskType: input.taskType, transactionId: input.transactionId, propertyId: input.propertyId, developerId: input.developerId, OR: [{ status: { in: [...activeTaskStatuses] } }, { status: "COMPLETED", updatedAt: { gte: recentCutoff } }] } });
  if (existing) return existing;
  let task; let created = false;
  try { task = await db.agentTask.create({ data: { dedupeKey, assignedAgentId: agent.id, taskType: input.taskType, title: input.title, description: input.description, transactionId: input.transactionId, propertyId: input.propertyId, developerId: input.developerId, evidenceCount: input.evidenceCount ?? 0, ownerApprovalRequired: input.ownerApprovalRequired ?? false } }); created = true; }
  catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    task = await db.agentTask.findUniqueOrThrow({ where: { dedupeKey } });
  }
  if (created) await db.agentEvent.create({ data: { taskId: task.id, actorAgentId: agent.id, type: "TASK_CREATED", summary: `${agent.name} queued ${task.title}.` } });
  return task;
}

export async function seedAgentWork() {
  const db = getPrisma();
  await ensureAgentTeam();
  const [properties, developers, transactions] = await Promise.all([
    db.property.findMany({ where: { opportunityStatus: { not: "REJECTED" } }, include: { researchFindings: true }, orderBy: { updatedAt: "asc" }, take: 10 }),
    db.developer.findMany({ where: { active: true }, orderBy: { updatedAt: "asc" }, take: 10 }),
    db.dealTransaction.findMany({ where: { controlStatus: { not: "STOPPED" } }, include: { property: { include: { researchFindings: true } }, documents: true, approvals: true }, orderBy: { updatedAt: "asc" }, take: 10 }),
  ]);
  await createTaskIfMissing({ role: "OPERATIONS_COORDINATOR", taskType: "COORDINATE_PIPELINE", title: "Review operating pipeline", description: "Summarize active, held, and owner-review work.", ownerApprovalRequired: false });
  for (const property of properties) await createTaskIfMissing({ role: "RESEARCH", taskType: "RESEARCH_PROPERTY", title: `Refresh ${property.address}`, description: "Refresh configured public sources and preserve manual-verification gaps.", propertyId: property.id, evidenceCount: property.researchFindings.filter((item) => item.status === "VERIFIED").length, ownerApprovalRequired: false });
  for (const developer of developers) await createTaskIfMissing({ role: "RESEARCH", taskType: "RESEARCH_DEVELOPER", title: `Refresh ${developer.companyName}`, description: "Refresh official public-source developer evidence.", developerId: developer.id, evidenceCount: developer.contactVerifiedAt ? 1 : 0, ownerApprovalRequired: false });
  for (const transaction of transactions) {
    const evidenceCount = transaction.property.researchFindings.filter((item) => item.status === "VERIFIED").length;
    await createTaskIfMissing({ role: "SELLER_ACQUISITION", taskType: "ASSESS_SELLER_FIT", title: `Assess seller fit · ${transaction.property.address}`, description: "Prepare an internal objective-fit checklist. No contact is authorized.", transactionId: transaction.id, propertyId: transaction.propertyId, evidenceCount, ownerApprovalRequired: true });
    await createTaskIfMissing({ role: "BUYER_DEVELOPER", taskType: "MATCH_BUYER", title: `Match buyers · ${transaction.property.address}`, description: "Rank verified buyer matches without sending outreach.", transactionId: transaction.id, propertyId: transaction.propertyId, evidenceCount, ownerApprovalRequired: true });
    await createTaskIfMissing({ role: "TRANSACTION_COMPLIANCE", taskType: "REVIEW_COMPLIANCE_EVIDENCE", title: `Review controls · ${transaction.property.address}`, description: "List missing documents, approvals, counsel, and compliance evidence.", transactionId: transaction.id, propertyId: transaction.propertyId, evidenceCount: transaction.documents.length + transaction.approvals.length, ownerApprovalRequired: true });
  }
  return { properties: properties.length, developers: developers.length, transactions: transactions.length };
}

async function performTask(task: Awaited<ReturnType<typeof loadTask>>) {
  if (!task) throw new Error("Agent task not found.");
  const taskType = task.taskType as AgentTaskType;
  if (!AGENT_TASK_TYPES.includes(taskType)) throw new Error("Unsupported agent task type.");
  if (taskType === "RESEARCH_PROPERTY" && task.propertyId) return { summary: `Property research completed.`, output: await researchProperty(task.propertyId) };
  if (taskType === "RESEARCH_DEVELOPER" && task.developerId) { const queued = await enqueueDeveloperResearch(task.developerId); return { summary: "Developer research processed.", output: await runQueuedDeveloperResearch(queued.id) }; }
  if (taskType === "MATCH_BUYER" && task.propertyId) { const matches = await scoreDeveloperMatches(task.propertyId, false); return { summary: `${matches.length} buyer matches ranked for owner review.`, output: { matches: matches.slice(0, 10) } }; }
  if (taskType === "ASSESS_SELLER_FIT") return { summary: "Seller-fit checklist prepared; authority, consent, goals, and minimum proceeds remain owner-verified fields.", output: { verifiedPropertyEvidence: task.evidenceCount, contactAttempted: false, protectedTraitsUsed: false } };
  if ((taskType === "REVIEW_COMPLIANCE_EVIDENCE" || taskType === "PREPARE_DOCUMENT_CHECKLIST") && task.transaction) {
    const missing = [!task.transaction.counselApprovedAt && "counsel approval", !task.transaction.complianceVerifiedAt && "compliance verification", task.transaction.documents.length === 0 && "transaction documents", task.transaction.approvals.length === 0 && "owner approvals"].filter(Boolean);
    return { summary: missing.length ? `${missing.length} compliance gates remain.` : "Recorded compliance gates are present for owner review.", output: { missing, controlStatus: task.transaction.controlStatus, documents: task.transaction.documents.length, approvals: task.transaction.approvals.length } };
  }
  if (taskType === "COORDINATE_PIPELINE") { const counts = await getPrisma().agentTask.groupBy({ by: ["status"], _count: true }); return { summary: "Pipeline status summarized for the owner.", output: { counts } }; }
  return { summary: "Internal work product prepared.", output: { contactAttempted: false, irreversibleActionTaken: false } };
}

async function loadTask(taskId: string) {
  return getPrisma().agentTask.findUnique({ where: { id: taskId }, include: { assignedAgent: true, transaction: { include: { documents: true, approvals: true } } } });
}

export async function runAgentTask(taskId: string) {
  const db = getPrisma();
  const task = await loadTask(taskId);
  if (!task || !["QUEUED", "WAITING_FOR_APPROVAL"].includes(task.status)) return { status: "skipped" as const };
  const taskType = task.taskType as AgentTaskType;
  const autonomyUnlocked = task.assignedAgent.autonomyMode === "APPROVED_AUTONOMOUS";
  const decision = evaluateAgentTask({ role: task.assignedAgent.role, taskType, transactionControl: task.transaction?.controlStatus, ownerApproved: !task.ownerApprovalRequired || Boolean(task.ownerApprovedAt), evidenceComplete: task.evidenceCount > 0 || ["COORDINATE_PIPELINE", "RESEARCH_PROPERTY", "RESEARCH_DEVELOPER", "PREPARE_DOCUMENT_CHECKLIST"].includes(taskType), operatingMode: autonomyUnlocked ? "AUTONOMOUS" : "SUPERVISED", autonomyEvidence: { jurisdictionConfigured: Boolean(task.transaction?.jurisdictionState), counselApproved: Boolean(task.assignedAgent.counselApprovedAt), complianceEvidenceVerified: Boolean(task.assignedAgent.complianceApprovedAt), provenComplianceRecord: Boolean(task.assignedAgent.legalStandardsProvenAt && task.assignedAgent.ethicalStandardsProvenAt) } });
  if (!decision.allowed) {
    const waiting = decision.outcome === "OWNER_APPROVAL_REQUIRED";
    await db.$transaction([db.agentTask.update({ where: { id: task.id }, data: { status: waiting ? "WAITING_FOR_APPROVAL" : "BLOCKED", output: { reasons: decision.reasons } } }), db.agentEvent.create({ data: { taskId: task.id, actorAgentId: task.assignedAgentId, type: waiting ? "APPROVAL_REQUESTED" : "TASK_UPDATED", summary: decision.reasons.join(" ") } })]);
    return { status: waiting ? "waiting" as const : "blocked" as const, reasons: decision.reasons };
  }
  const run = await db.$transaction(async (tx) => {
    await tx.agentTask.update({ where: { id: task.id }, data: { status: "IN_PROGRESS", startedAt: new Date(), attemptCount: { increment: 1 } } });
    const created = await tx.agentRun.create({ data: { agentId: task.assignedAgentId, taskId: task.id } });
    await tx.agentEvent.create({ data: { taskId: task.id, runId: created.id, actorAgentId: task.assignedAgentId, type: "TASK_STARTED", summary: `${task.assignedAgent.name} started ${task.title}.` } });
    return created;
  });
  try {
    const result = await performTask(task);
    await db.$transaction([db.agentTask.update({ where: { id: task.id }, data: { status: "COMPLETED", completedAt: new Date(), output: result.output as Prisma.InputJsonValue } }), db.agentRun.update({ where: { id: run.id }, data: { status: "COMPLETED", summary: result.summary, finishedAt: new Date() } }), db.agentEvent.create({ data: { taskId: task.id, runId: run.id, actorAgentId: task.assignedAgentId, type: "TASK_COMPLETED", summary: result.summary } })]);
    return { status: "completed" as const, summary: result.summary };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Agent task failed.";
    await db.$transaction([db.agentTask.update({ where: { id: task.id }, data: { status: "FAILED", output: { error: message } } }), db.agentRun.update({ where: { id: run.id }, data: { status: "FAILED", error: message, finishedAt: new Date() } }), db.agentEvent.create({ data: { taskId: task.id, runId: run.id, actorAgentId: task.assignedAgentId, type: "RUN_FAILED", summary: message } })]);
    return { status: "failed" as const, error: message };
  }
}

export async function runAgentQueue(agentId: string, limit = 3) {
  await seedAgentWork();
  const tasks = await getPrisma().agentTask.findMany({ where: { assignedAgentId: agentId, status: { in: ["QUEUED", "WAITING_FOR_APPROVAL"] } }, orderBy: [{ priority: "desc" }, { createdAt: "asc" }], take: Math.max(1, Math.min(limit, 10)) });
  const results = [];
  for (const task of tasks) results.push(await runAgentTask(task.id));
  return { processed: results.length, results };
}

export async function runAgentTeamBatch() {
  const agents = await ensureAgentTeam();
  await seedAgentWork();
  const results = [];
  for (const agent of agents.filter((item) => item.status === "ACTIVE")) results.push({ agentId: agent.id, ...(await runAgentQueue(agent.id, 2)) });
  return { agents: results.length, results };
}

export async function reviewAgentTask(taskId: string, approved: boolean, note: string) {
  if (!approved && !note.trim()) throw new Error("A rejection reason is required.");
  const db = getPrisma();
  const task = await db.agentTask.findUnique({ where: { id: taskId }, include: { transaction: true } });
  if (!task) throw new Error("Agent task not found.");
  if (task.transaction?.controlStatus === "STOPPED") throw new Error("A stopped transaction cannot receive agent approval.");
  const status = approved ? "QUEUED" : "CANCELLED";
  await db.$transaction([db.agentTask.update({ where: { id: taskId }, data: { status, ownerApprovedAt: approved ? new Date() : null, ownerApprovedBy: approved ? "owner" : null, approvalReason: note.trim() || (approved ? "Owner approved internal processing." : null) } }), db.agentEvent.create({ data: { taskId, type: "APPROVAL_DECIDED", summary: approved ? "Owner approved internal agent work." : `Owner rejected agent work: ${note.trim()}` } })]);
  return { status };
}

export async function readAgentDashboard() {
  await seedAgentWork();
  const db = getPrisma();
  const [agents, approvalTasks, recentTasks, events] = await Promise.all([
    db.agent.findMany({ include: { assignedTasks: { select: { status: true } }, runs: { orderBy: { startedAt: "desc" }, take: 1 } }, orderBy: { role: "asc" } }),
    db.agentTask.findMany({ where: { status: "WAITING_FOR_APPROVAL" }, include: { assignedAgent: true, transaction: { include: { property: true } } }, orderBy: { updatedAt: "desc" }, take: 30 }),
    db.agentTask.findMany({ include: { assignedAgent: true, transaction: { include: { property: true } } }, orderBy: { updatedAt: "desc" }, take: 30 }),
    db.agentEvent.findMany({ include: { actorAgent: true, task: { include: { assignedAgent: true } } }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  const taskSummary = (task: (typeof recentTasks)[number]) => ({ id: task.id, title: task.title, agentId: task.assignedAgentId, agentName: task.assignedAgent.name, status: task.status, transactionLabel: task.transaction?.property.address ?? null, evidenceCount: task.evidenceCount, createdAt: task.createdAt.toISOString(), updatedAt: task.updatedAt.toISOString() });
  return {
    agents: agents.map((agent) => { const statuses = agent.assignedTasks.map((task) => task.status); const blockers = [!agent.legalStandardsProvenAt && "legal proof", !agent.ethicalStandardsProvenAt && "ethical proof", !agent.complianceApprovedAt && "compliance approval", !agent.counselApprovedAt && "counsel approval", !agent.ownerAutonomyApprovedAt && "owner approval"].filter(Boolean) as string[]; return { id: agent.id, name: agent.name, role: agent.role.replaceAll("_", " "), status: agent.status, queuedTasks: statuses.filter((value) => value === "QUEUED").length, activeTasks: statuses.filter((value) => value === "IN_PROGRESS").length, approvalTasks: statuses.filter((value) => value === "WAITING_FOR_APPROVAL").length, completedTasks: statuses.filter((value) => value === "COMPLETED").length, lastActiveAt: agent.runs[0]?.startedAt.toISOString() ?? null, supervisionMode: "SUPERVISED" as const, autonomyEligible: blockers.length === 0, autonomyBlockers: blockers }; }),
    approvalTasks: approvalTasks.map(taskSummary), recentTasks: recentTasks.map(taskSummary),
    events: events.map((event) => ({ id: event.id, agentName: event.actorAgent?.name || event.task.assignedAgent.name, summary: event.summary, createdAt: event.createdAt.toISOString() })),
  };
}
